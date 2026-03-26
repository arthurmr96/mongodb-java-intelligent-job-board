package com.example.jobmatching.controller;

import com.example.jobmatching.model.JobPosting;
import com.example.jobmatching.service.EmbedderService;
import com.example.jobmatching.service.JobExtractorService;
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
 * REST controller for job posting ingestion and retrieval.
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code POST /jobs/parse-pdf} — parse a job posting PDF and return an
 *       auto-filled {@link JobPosting} for review. Nothing is saved.</li>
 *   <li>{@code POST /jobs} — receive the confirmed posting, generate an
 *       embedding, and publish to MongoDB with {@code status: "published"}.</li>
 *   <li>{@code GET /jobs/{id}} — retrieve a single job by ObjectId.</li>
 *   <li>{@code GET /jobs} — list published jobs (paginated).</li>
 * </ul>
 *
 * <p>The lifecycle is: PDF extraction returns a {@code status: "draft"}
 * payload for review. On recruiter confirmation, the posting is saved with
 * {@code status: "published"} and becomes visible to candidates.
 */
@RestController
@RequestMapping("/jobs")
@CrossOrigin(origins = "*")
public class JobController {

    private final PdfParserService pdfParserService;
    private final JobExtractorService jobExtractorService;
    private final EmbedderService embedderService;
    private final MongoCollection<Document> jobsCollection;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public JobController(
            PdfParserService pdfParserService,
            JobExtractorService jobExtractorService,
            EmbedderService embedderService,
            MongoCollection<Document> jobsCollection) {
        this.pdfParserService = pdfParserService;
        this.jobExtractorService = jobExtractorService;
        this.embedderService = embedderService;
        this.jobsCollection = jobsCollection;
    }

    // ── PDF parse (review only — nothing saved) ────────────────────────────

    /**
     * Accepts a job posting PDF and returns a pre-filled {@link JobPosting} JSON
     * payload for the recruiter review form.
     *
     * <p>The returned object has {@code status: "draft"} — it is not persisted
     * to MongoDB until the recruiter confirms via {@code POST /jobs}.
     *
     * @param file the uploaded PDF ({@code multipart/form-data})
     * @return a pre-filled {@link JobPosting} for the review form
     */
    @PostMapping(value = "/parse-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> parsePdf(@RequestParam("file") MultipartFile file) {
        try {
            String rawText = pdfParserService.extractText(file);
            JobPosting posting = jobExtractorService.extract(rawText);
            posting.setSource("pdf");
            posting.setStatus("draft");
            return ResponseEntity.ok(posting);
        } catch (IOException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Request interrupted"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getClass().getSimpleName() + ": " + e.getMessage()));
        }
    }

    // ── Save confirmed job posting ─────────────────────────────────────────

    /**
     * Receives the recruiter-confirmed {@link JobPosting}, generates a VoyageAI
     * embedding, and persists the document with {@code status: "published"}.
     *
     * <p>Flow:
     * <ol>
     *   <li>Validate that required fields (title, requiredSkills, summary) are present.</li>
     *   <li>Build the {@code embedText} string.</li>
     *   <li>Call the Atlas VoyageAI REST API with {@code input_type: "document"}.</li>
     *   <li>Attach {@code embedText} and {@code embedding} to the document.</li>
     *   <li>Insert into the {@code jobs} collection with {@code status: "published"}.</li>
     *   <li>Return the saved document with its new {@code _id}.</li>
     * </ol>
     *
     * @param posting the confirmed job posting from the review form
     * @return the persisted document including the generated {@code _id}
     */
    @PostMapping
    public ResponseEntity<?> saveJob(@RequestBody JobPosting posting) {
        try {
            // 1. Basic validation
            if (posting.getTitle() == null || posting.getTitle().isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Job title is required"));
            }

            // 2. Build embedText
            String embedText = embedderService.buildEmbedText(posting);

            // 3. Generate embedding via Atlas VoyageAI REST API
            List<Double> embedding = embedderService.embedDocument(embedText);

            // 4. Convert POJO to BSON Document
            String json = objectMapper.writeValueAsString(posting);
            Document doc = Document.parse(json);

            // 5. Attach vector fields and metadata
            doc.append("embedText", embedText)
               .append("embedding", embedding)
               .append("status", "published")
               .append("createdAt", Instant.now().toString())
               .append("updatedAt", Instant.now().toString());

            doc.remove("id");

            // 6. Insert into MongoDB
            jobsCollection.insertOne(doc);

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
     * Retrieves a single job posting by ObjectId.
     *
     * @param id hex ObjectId string
     * @return the job document, or 404 if not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getJob(@PathVariable String id) {
        try {
            Document doc = jobsCollection
                    .find(new Document("_id", new ObjectId(id)))
                    .first();

            if (doc == null) {
                return ResponseEntity.notFound().build();
            }

            doc.append("id", doc.getObjectId("_id").toHexString());
            doc.remove("_id");

            return ResponseEntity.ok(doc);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid ObjectId: " + id));
        }
    }

    /**
     * Lists all published job postings, most recently created first.
     *
     * @param limit  maximum number of results to return (default 20)
     * @param offset number of results to skip (for pagination)
     * @return a list of job posting documents
     */
    @GetMapping
    public ResponseEntity<?> listJobs(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {

        List<Document> results = new java.util.ArrayList<>();
        jobsCollection
                .find(new Document("status", "published"))
                .sort(new Document("createdAt", -1))
                .skip(offset)
                .limit(limit)
                .forEach(doc -> {
                    doc.append("id", doc.getObjectId("_id").toHexString());
                    doc.remove("_id");
                    // Omit the embedding array from list responses
                    doc.remove("embedding");
                    results.add(doc);
                });

        return ResponseEntity.ok(results);
    }
}
