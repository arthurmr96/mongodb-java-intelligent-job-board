package com.example.jobmatching.service;

import com.example.jobmatching.model.JobPosting;
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

/**
 * Converts raw job posting text into a structured {@link JobPosting} by calling
 * an LLM REST API.
 *
 * <p>Follows the same pattern as {@link CvExtractorService}: a single LLM call
 * with a structured-JSON prompt, parsed with Jackson into a POJO. The result is
 * returned to the recruiter as a review payload — nothing is written to MongoDB
 * until the recruiter confirms via {@code POST /jobs}.
 */
@Service
public class JobExtractorService {

    @Value("${llm.api.key}")
    private String llmApiKey;

    @Value("${llm.api.url}")
    private String llmApiUrl;

    @Value("${llm.model}")
    private String llmModel;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    /**
     * Sends the raw job posting text to an LLM and returns a pre-filled
     * {@link JobPosting} ready for the review form.
     *
     * @param rawText plain text extracted from the job posting PDF
     * @return a partially or fully populated {@link JobPosting} (not yet saved)
     * @throws IOException          if the HTTP call fails
     * @throws InterruptedException if the thread is interrupted while waiting
     */
    public JobPosting extract(String rawText) throws IOException, InterruptedException {
        String prompt = buildPrompt(rawText);
        String requestBody = buildRequestBody(prompt);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(llmApiUrl))
                .header("Authorization", "Bearer " + llmApiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(120))
                .build();

        HttpResponse<String> response = httpClient.send(
                request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IOException("LLM API error: HTTP " + response.statusCode()
                    + " — " + response.body());
        }

        return parseResponse(response.body());
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private String buildPrompt(String rawText) {
        return """
                Extract structured data from the job posting text below.
                Return ONLY a valid JSON object — no markdown, no explanation.

                JSON schema:
                {
                  "title": "string (exact job title)",
                  "company": "string",
                  "location": "string (city/country or 'Remote')",
                  "remotePolicy": "remote | hybrid | on-site",
                  "seniority": "junior | mid | senior | lead | principal",
                  "employmentType": "full-time | part-time | contract",
                  "salary": { "min": integer_or_null, "max": integer_or_null, "currency": "string_or_null" },
                  "summary": "string (role summary / about section)",
                  "responsibilities": ["string"],
                  "requiredSkills": [
                    { "name": "string", "area": "string", "minYears": integer_or_null }
                  ],
                  "preferredSkills": [
                    { "name": "string", "area": "string", "minYears": null }
                  ]
                }

                Rules:
                - Use null for any field you cannot find in the text.
                - For "minYears": extract only if explicitly stated; otherwise null.
                - "seniority" must be one of the enum values above; infer from the title or description.
                - Do NOT invent data that is not present in the posting text.

                JOB POSTING TEXT:
                """ + rawText;
    }

    private String buildRequestBody(String prompt) throws IOException {
        String escapedPrompt = objectMapper.writeValueAsString(prompt);

        return """
                {
                  "model": "%s",
                  "response_format": { "type": "json_object" },
                  "messages": [
                    {
                      "role": "system",
                      "content": "You are a job posting parser. Extract structured fields from job description text and return only valid JSON."
                    },
                    {
                      "role": "user",
                      "content": %s
                    }
                  ],
                  "temperature": 0
                }
                """.formatted(llmModel, escapedPrompt);
    }

    private JobPosting parseResponse(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        String content = root
                .path("choices")
                .path(0)
                .path("message")
                .path("content")
                .asText();

        return objectMapper.readValue(content, JobPosting.class);
    }
}
