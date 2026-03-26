package com.example.jobmatching.service;

import com.example.jobmatching.model.CandidateProfile;
import com.example.jobmatching.model.JobPosting;
import com.example.jobmatching.model.RequiredSkill;
import com.example.jobmatching.model.Skill;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Builds the {@code embedText} string for a document and calls the
 * <a href="https://www.mongodb.com/docs/atlas/atlas-vector-search/ai-integrations/voyage-ai/">
 * Atlas Embedding and Reranking REST API</a> to generate a VoyageAI vector.
 *
 * <h3>Why a REST call instead of a SDK?</h3>
 * <p>There is no official VoyageAI Java SDK. The Atlas API is a language-agnostic
 * REST endpoint, and Java 21's built-in {@link java.net.http.HttpClient} handles
 * it cleanly with zero extra dependencies.
 *
 * <h3>What gets embedded?</h3>
 * <p>Only semantically meaningful content is included in {@code embedText}.
 * Identity fields (name, email, company name), salary, location, and dates
 * dilute the vector and should instead be used as structured pre-filters.
 *
 * <ul>
 *   <li><b>Candidate</b>: seniority (inferred) + skills (name, area, years) + summary</li>
 *   <li><b>Job</b>: title + required skills (name, area, minYears) + summary + responsibilities</li>
 * </ul>
 *
 * <h3>{@code input_type} matters</h3>
 * <p>Pass {@code "document"} when embedding stored content (at write time) and
 * {@code "query"} when embedding a live search query (at match time). VoyageAI
 * models prepend an internal optimisation prompt based on this hint, producing
 * better-aligned vectors and improved match quality.
 */
@Service
public class EmbedderService {

    @Value("${voyage.api.key}")
    private String voyageApiKey;

    @Value("${voyage.model}")
    private String voyageModel;

    @Value("${voyage.api.url}")
    private String voyageApiUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    // ── embedText builders ─────────────────────────────────────────────────

    /**
     * Constructs the normalised embed string for a candidate profile.
     *
     * <p>Format:
     * <pre>
     *   "{seniority} | Skills: Apache Kafka (Data Engineering, 4yr), Java (Programming, 7yr) | Summary: ..."
     * </pre>
     *
     * @param candidate the confirmed candidate (must have skills and summary populated)
     * @return the embed string to send to the Atlas API
     */
    public String buildEmbedText(CandidateProfile candidate) {
        StringBuilder sb = new StringBuilder();

        // Infer seniority from the most recent job title (if available)
        String seniority = inferSeniority(candidate);
        if (seniority != null) {
            sb.append(seniority);
        }

        // Skills section
        if (candidate.getSkills() != null && !candidate.getSkills().isEmpty()) {
            sb.append(" | Skills: ");
            String skillsPart = candidate.getSkills().stream()
                    .map(this::formatSkill)
                    .collect(Collectors.joining(", "));
            sb.append(skillsPart);
        }

        // Summary section
        if (candidate.getSummary() != null && !candidate.getSummary().isBlank()) {
            sb.append(" | Summary: ").append(candidate.getSummary().strip());
        }

        return sb.toString().strip();
    }

    /**
     * Constructs the normalised embed string for a job posting.
     *
     * <p>Format:
     * <pre>
     *   "Senior Data Engineer | Required: Apache Kafka (Data Engineering, 3yr+), Java (Programming, 5yr+)
     *    | Summary: ... | Responsibilities: ..."
     * </pre>
     *
     * @param job the confirmed job posting (must have title, requiredSkills, and summary populated)
     * @return the embed string to send to the Atlas API
     */
    public String buildEmbedText(JobPosting job) {
        StringBuilder sb = new StringBuilder();

        // Title
        if (job.getTitle() != null && !job.getTitle().isBlank()) {
            sb.append(job.getTitle().strip());
        }

        // Required skills section
        if (job.getRequiredSkills() != null && !job.getRequiredSkills().isEmpty()) {
            sb.append(" | Required: ");
            String skillsPart = job.getRequiredSkills().stream()
                    .map(this::formatRequiredSkill)
                    .collect(Collectors.joining(", "));
            sb.append(skillsPart);
        }

        // Summary section
        if (job.getSummary() != null && !job.getSummary().isBlank()) {
            sb.append(" | Summary: ").append(job.getSummary().strip());
        }

        // Responsibilities section (join bullet points)
        if (job.getResponsibilities() != null && !job.getResponsibilities().isEmpty()) {
            String responsibilities = job.getResponsibilities().stream()
                    .map(String::strip)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.joining(". "));
            sb.append(" | Responsibilities: ").append(responsibilities);
        }

        return sb.toString().strip();
    }

    // ── Atlas REST API call ────────────────────────────────────────────────

    /**
     * Calls the Atlas Embedding and Reranking REST API and returns the
     * 1 024-element float vector for the given text.
     *
     * <p>The API endpoint is {@code POST https://ai.mongodb.com/v1/embeddings}.
     * Authentication uses a Bearer token (the Atlas API key).
     *
     * @param text      the {@code embedText} string to encode
     * @param inputType {@code "document"} for stored content, {@code "query"} for search queries
     * @return a list of 1 024 doubles representing the embedding vector
     * @throws IOException          if the HTTP call fails or the response is not 200 OK
     * @throws InterruptedException if the thread is interrupted while waiting
     */
    public List<Double> embed(String text, String inputType)
            throws IOException, InterruptedException {

        // Escape text for safe JSON embedding
        String escapedText = objectMapper.writeValueAsString(text);

        String requestBody = """
                {
                  "input": [%s],
                  "model": "%s",
                  "input_type": "%s"
                }
                """.formatted(escapedText, voyageModel, inputType);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(voyageApiUrl))
                .header("Authorization", "Bearer " + voyageApiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(
                request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("Atlas embedding API error: HTTP " + response.statusCode()
                    + " — " + response.body());
        }

        return parseEmbedding(response.body());
    }

    /**
     * Convenience overload for embedding a document (stored content).
     * Equivalent to {@code embed(text, "document")}.
     */
    public List<Double> embedDocument(String text) throws IOException, InterruptedException {
        return embed(text, "document");
    }

    /**
     * Convenience overload for embedding a search query (real-time lookup).
     * Equivalent to {@code embed(text, "query")}.
     */
    public List<Double> embedQuery(String text) throws IOException, InterruptedException {
        return embed(text, "query");
    }

    // ── Private helpers ────────────────────────────────────────────────────

    /**
     * Parses the Atlas API response and extracts the embedding array.
     *
     * <p>The response shape is:
     * <pre>
     *   { "data": [{ "embedding": [0.021, -0.134, ...] }], ... }
     * </pre>
     */
    private List<Double> parseEmbedding(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode embeddingNode = root.path("data").path(0).path("embedding");

        if (embeddingNode.isMissingNode() || !embeddingNode.isArray()) {
            throw new IOException("Unexpected embedding API response shape: " + responseBody);
        }

        List<Double> embedding = new ArrayList<>(embeddingNode.size());
        for (JsonNode value : embeddingNode) {
            embedding.add(value.asDouble());
        }
        return embedding;
    }

    /** Formats a candidate skill entry for inclusion in embedText. */
    private String formatSkill(Skill skill) {
        StringBuilder sb = new StringBuilder(skill.getName());
        if (skill.getArea() != null || skill.getYears() != null) {
            sb.append(" (");
            if (skill.getArea() != null) sb.append(skill.getArea());
            if (skill.getArea() != null && skill.getYears() != null) sb.append(", ");
            if (skill.getYears() != null) sb.append(skill.getYears()).append("yr");
            sb.append(")");
        }
        return sb.toString();
    }

    /** Formats a required skill entry for inclusion in embedText. */
    private String formatRequiredSkill(RequiredSkill skill) {
        StringBuilder sb = new StringBuilder(skill.getName());
        if (skill.getArea() != null || skill.getMinYears() != null) {
            sb.append(" (");
            if (skill.getArea() != null) sb.append(skill.getArea());
            if (skill.getArea() != null && skill.getMinYears() != null) sb.append(", ");
            if (skill.getMinYears() != null) sb.append(skill.getMinYears()).append("yr+");
            sb.append(")");
        }
        return sb.toString();
    }

    /**
     * Infers a seniority label from the most recent experience entry title.
     * Returns {@code null} if experience data is not available.
     */
    private String inferSeniority(CandidateProfile candidate) {
        if (candidate.getExperience() == null || candidate.getExperience().isEmpty()) {
            return null;
        }
        // Use the first experience entry (most recent after LLM extraction)
        String title = candidate.getExperience().get(0).getTitle();
        if (title == null) return null;

        String lower = title.toLowerCase();
        if (lower.contains("principal") || lower.contains("staff")) return "Principal Engineer";
        if (lower.contains("lead") || lower.contains("architect")) return "Lead Engineer";
        if (lower.contains("senior") || lower.contains("sr.") || lower.contains("sr ")) return "Senior Engineer";
        if (lower.contains("junior") || lower.contains("jr.") || lower.contains("jr ")) return "Junior Engineer";
        return title; // use the title as-is if no level keyword found
    }
}
