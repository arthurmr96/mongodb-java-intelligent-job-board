package com.example.jobmatching.config;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MongoDB wiring.
 *
 * <p>Creates a single {@link MongoClient} from the URI supplied in
 * {@code application.properties} (which reads the {@code MONGODB_URI}
 * environment variable) and exposes the three application collections as
 * injectable {@link MongoCollection} beans.
 *
 * <p>Using the sync driver directly — rather than Spring Data MongoDB — keeps
 * the aggregation pipeline code explicit and makes the {@code $vectorSearch}
 * stage easy to read in the article.
 */
@Configuration
public class MongoConfig {

    @Value("${mongodb.uri}")
    private String mongoUri;

    @Value("${mongodb.database}")
    private String databaseName;

    // ── Client & database ──────────────────────────────────────────────────

    @Bean
    public MongoClient mongoClient() {
        MongoClientSettings settings = MongoClientSettings.builder()
            .applyConnectionString(new ConnectionString(mongoUri))
            .applicationName("intelligent-job-matching")
            .build();
        return MongoClients.create(settings);
    }

    @Bean
    public MongoDatabase mongoDatabase(MongoClient mongoClient) {
        return mongoClient.getDatabase(databaseName);
    }

    // ── Collections ────────────────────────────────────────────────────────

    /**
     * The {@code candidates} collection.
     * Each document stores a candidate profile, its {@code embedText}, and its
     * {@code embedding} vector (1 024 floats, voyage-4-large).
     */
    @Bean
    public MongoCollection<Document> candidatesCollection(MongoDatabase db) {
        return db.getCollection(MongoSchemaConstants.CANDIDATES_COLLECTION);
    }

    /**
     * The {@code jobs} collection.
     * Each document stores a job posting, its {@code embedText}, and its
     * {@code embedding} vector (1 024 floats, voyage-4-large).
     */
    @Bean
    public MongoCollection<Document> jobsCollection(MongoDatabase db) {
        return db.getCollection(MongoSchemaConstants.JOBS_COLLECTION);
    }

    /**
     * The {@code matches} collection.
     * Stores cached match results (composite score, matched/missing skills)
     * so that the frontend can retrieve previous results quickly.
     */
    @Bean
    public MongoCollection<Document> matchesCollection(MongoDatabase db) {
        return db.getCollection(MongoSchemaConstants.MATCHES_COLLECTION);
    }
}
