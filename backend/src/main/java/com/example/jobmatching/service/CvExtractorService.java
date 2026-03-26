package com.example.jobmatching.service;

import com.example.jobmatching.model.CandidateProfile;
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
 * Converts raw CV text into a structured {@link CandidateProfile} by calling
 * an LLM REST API.
 *
 * <p>The service uses Java 21's built-in {@link java.net.http.HttpClient} — no
 * extra HTTP library dependency is needed. The LLM prompt instructs the model
 * to return a single JSON object whose shape matches {@link CandidateProfile},
 * which Jackson then deserialises directly.
 *
 * <p><b>Nothing is written to MongoDB here.</b> The resulting
 * {@link CandidateProfile} is returned to the frontend as a review payload.
 * The user confirms (or corrects) the fields before the document is saved via
 * {@code POST /candidates}.
 */
@Service
public class CvExtractorService {

    @Value("${llm.api.key}")
    private String llmApiKey;

    @Value("${llm.api.url}")
    private String llmApiUrl;

    @Value("${llm.model}")
    private String llmModel;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // HttpClient is thread-safe and intended to be shared.
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    /**
     * Sends the raw CV text to an LLM and returns a pre-filled
     * {@link CandidateProfile} ready for the review form.
     *
     * @param rawText plain text extracted from the CV PDF
     * @return a partially or fully populated {@link CandidateProfile} (not yet saved)
     * @throws IOException          if the HTTP call fails
     * @throws InterruptedException if the thread is interrupted while waiting
     */
    public CandidateProfile extract(String rawText) throws IOException, InterruptedException {
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

    /**
     * Constructs the system + user prompt that instructs the LLM to produce a
     * structured JSON object matching the {@link CandidateProfile} schema.
     *
     * <p>Key prompt decisions:
     * <ul>
     *   <li>Explicit JSON schema in the system prompt avoids hallucinated field names.</li>
     *   <li>{@code "years"} is described as "estimated integer, null if unknown" so the
     *       model doesn't fabricate numbers.</li>
     *   <li>The instruction to return <em>only</em> JSON (no markdown, no prose)
     *       keeps the response parseable.</li>
     * </ul>
     */
    private String buildPrompt(String rawText) {
        return """
                Extract structured data from the CV text below.
                Return ONLY a valid JSON object — no markdown, no explanation.

                JSON schema:
                {
                  "name": "string",
                  "email": "string",
                  "phone": "string",
                  "location": "string (city, country/state)",
                  "summary": "string (professional summary or about section, verbatim or lightly cleaned)",
                  "skills": [
                    { "name": "string", "area": "string (e.g. Data Engineering, Programming, Databases)", "years": integer_or_null }
                  ],
                  "experience": [
                    {
                      "company": "string",
                      "title": "string",
                      "start": "YYYY-MM string",
                      "end": "YYYY-MM string or null if current",
                      "description": "string (role description / bullet points joined)"
                    }
                  ],
                  "education": [
                    { "degree": "string", "institution": "string", "year": integer_or_null }
                  ],
                  "certifications": ["string"]
                }

                Rules:
                - Use null for any field you cannot find in the text.
                - For "years" in skills: estimate from work history context; use null if uninferable.
                - Do NOT invent data that is not present in the CV text.

                CV TEXT:
                """ + rawText;
    }

    /**
     * Wraps the prompt in an OpenAI-compatible chat completion request body.
     *
     * <p>The {@code response_format} hint asks models that support it (e.g.
     * GPT-4o-mini) to guarantee JSON output and skip any markdown fencing.
     */
    private String buildRequestBody(String prompt) throws IOException {
        // Build the request JSON manually to avoid adding a dependency.
        // Escape the prompt text so it is safe inside a JSON string.
        String escapedPrompt = objectMapper.writeValueAsString(prompt);

        return """
                {
                  "model": "%s",
                  "response_format": { "type": "json_object" },
                  "messages": [
                    {
                      "role": "system",
                      "content": "You are a CV parser. Extract structured fields from CV text and return only valid JSON."
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

    /**
     * Extracts the assistant message content from the chat completion response
     * and deserialises it into a {@link CandidateProfile}.
     */
    private CandidateProfile parseResponse(String responseBody) throws IOException {
        JsonNode root = objectMapper.readTree(responseBody);
        String content = root
                .path("choices")
                .path(0)
                .path("message")
                .path("content")
                .asText();

        return objectMapper.readValue(content, CandidateProfile.class);
    }
}
