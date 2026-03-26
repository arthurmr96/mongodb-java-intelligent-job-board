package com.example.jobmatching;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the Intelligent Job Matching Platform.
 *
 * <p>The application exposes three groups of REST endpoints:
 * <ul>
 *   <li>{@code /candidates} — CV ingestion, review, and retrieval</li>
 *   <li>{@code /jobs}       — Job posting ingestion, review, and retrieval</li>
 *   <li>{@code /match}      — Vector search–powered candidate ↔ job matching</li>
 * </ul>
 *
 * <p>Configuration is loaded from {@code application.properties}, which reads
 * {@code MONGODB_URI}, {@code VOYAGE_API_KEY}, and {@code LLM_API_KEY} from
 * environment variables (or a {@code .env} file when using Docker Compose).
 */
@SpringBootApplication
public class JobMatchingApplication {

    public static void main(String[] args) {
        SpringApplication.run(JobMatchingApplication.class, args);
    }
}
