package com.example.jobmatching.controller;

import com.example.jobmatching.model.CandidateProfile;
import com.example.jobmatching.service.CvExtractorService;
import com.example.jobmatching.service.EmbedderService;
import com.example.jobmatching.service.PdfParserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoCollection;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * REST controller for candidate ingestion and retrieval.
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code POST /candidates/parse-pdf} — parse a CV PDF and return an
 *       auto-filled {@link CandidateProfile} for review. Nothing is saved.</li>
 *   <li>{@code POST /candidates} — receive the confirmed profile, generate an
 *       embedding, and persist to MongoDB.</li>
 *   <li>{@code GET /candidates/{id}} — retrieve a saved candidate by ObjectId.</li>
 *   <li>{@code GET /candidates} — list all saved candidates (paginated).</li>
 * </ul>
 */
@RestController
@RequestMapping("/candidates")
@CrossOrigin(origins = "*") // Relaxed for dev; tighten for production
public class CandidateController {

    private final PdfParserService pdfParserService;
    private final CvExtractorService cvExtractorService;
    private final EmbedderService embedderService;
    private final MongoCollection<Document> candidatesCollection;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CandidateController(
            PdfParserService pdfParserService,
            CvExtractorService cvExtractorService,
            EmbedderService embedderService,
            MongoCollection<Document> candidatesCollection) {
        this.pdfParserService = pdfParserService;
        this.cvExtractorService = cvExtractorService;
        this.embedderService = embedderService;
        this.candidatesCollection = candidatesCollection;
    }

    // ── PDF parse (review only — nothing saved) ────────────────────────────

    /**
     * Accepts a CV PDF upload and returns a pre-filled {@link CandidateProfile}
     * JSON payload for the frontend review form.
     *
     * <p>Flow:
     * <ol>
     *   <li>Extract raw text from the PDF via Apache PDFBox.</li>
     *   <li>Send the text to the LLM extractor to produce a structured POJO.</li>
     *   <li>Return the POJO as JSON — <em>nothing is written to MongoDB</em>.</li>
     * </ol>
     *
     * @param file the uploaded PDF ({@code multipart/form-data})
     * @return a pre-filled {@link CandidateProfile} for the review form
     */
    @PostMapping(value = "/parse-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> parsePdf(@RequestParam("file") MultipartFile file) {
        try {
            String rawText = pdfParserService.extractText(file);
            CandidateProfile profile = cvExtractorService.extract(rawText);
            profile.setSource("pdf");
            return ResponseEntity.ok(profile);
        } catch (IOException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Request interrupted"));
        } catch (Exception e) {
            // Catch-all: surfaces the real cause (e.g. LLM connection refused,
            // JSON parse failure) instead of returning a plain Spring 500 page.
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getClass().getSimpleName() + ": " + e.getMessage()));
        }
    }

    // ── Save confirmed candidate ───────────────────────────────────────────

    /**
     * Receives the user-confirmed {@link CandidateProfile}, generates a VoyageAI
     * embedding via the Atlas REST API, and persists the full document to MongoDB.
     *
     * <p>Flow:
     * <ol>
     *   <li>Validate that required fields (name, summary, skills) are present.</li>
     *   <li>Build the {@code embedText} string.</li>
     *   <li>Call the Atlas VoyageAI REST API with {@code input_type: "document"}.</li>
     *   <li>Attach {@code embedText} and {@code embedding} to the document.</li>
     *   <li>Insert into the {@code candidates} collection.</li>
     *   <li>Return the saved document with its new {@code _id}.</li>
     * </ol>
     *
     * @param profile the confirmed candidate profile from the review form
     * @return the persisted document including the generated {@code _id}
     */
    @PostMapping
    public ResponseEntity<?> saveCandidate(@RequestBody CandidateProfile profile) {
        try {
            // 1. Basic validation
            if (profile.getName() == null || profile.getName().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Candidate name is required"));
            }

            // 2. Build embedText
            String embedText = embedderService.buildEmbedText(profile);

            // 3. Generate embedding via Atlas VoyageAI REST API
            List<Double> embedding = embedderService.embedDocument(embedText);

            // 4. Convert POJO to BSON Document
            String json = objectMapper.writeValueAsString(profile);
            Document doc = Document.parse(json);

            // 5. Attach vector fields and metadata
            doc.append("embedText", embedText)
               .append("embedding", embedding)
               .append("status", "active")
               .append("createdAt", Instant.now().toString())
               .append("updatedAt", Instant.now().toString());

            // Remove any null id field from the POJO serialisation
            doc.remove("id");

            // 6. Insert into MongoDB
            candidatesCollection.insertOne(doc);

            // 7. Return saved document with _id
            String insertedId = doc.getObjectId("_id").toHexString();
            doc.append("id", insertedId);
            doc.remove("_id");

            return ResponseEntity.ok(doc);

        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Embedding or serialisation failed: " + e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Request interrupted"));
        }
    }

    // ── Retrieval ──────────────────────────────────────────────────────────

    /**
     * Retrieves a saved candidate by ObjectId.
     *
     * @param id hex ObjectId string
     * @return the candidate document, or 404 if not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getCandidate(@PathVariable String id) {
        try {
            Document doc = candidatesCollection
                    .find(new Document("_id", new ObjectId(id)))
                    .first();

            if (doc == null) {
                return ResponseEntity.notFound().build();
            }

            // Convert ObjectId to string for JSON friendliness
            doc.append("id", doc.getObjectId("_id").toHexString());
            doc.remove("_id");

            return ResponseEntity.ok(doc);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid ObjectId: " + id));
        }
    }

    /**
     * Lists all active candidates, most recently created first.
     *
     * @param limit  maximum number of results to return (default 20)
     * @param offset number of results to skip (for pagination)
     * @return a list of candidate documents
     */
    @GetMapping
    public ResponseEntity<?> listCandidates(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {

        List<Document> results = new java.util.ArrayList<>();
        candidatesCollection
                .find(new Document("status", "active"))
                .sort(new Document("createdAt", -1))
                .skip(offset)
                .limit(limit)
                .forEach(doc -> {
                    doc.append("id", doc.getObjectId("_id").toHexString());
                    doc.remove("_id");
                    // Omit the embedding array from list responses to reduce payload size
                    doc.remove("embedding");
                    results.add(doc);
                });

        return ResponseEntity.ok(results);
    }
}
