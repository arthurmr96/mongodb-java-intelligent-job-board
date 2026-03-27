package com.example.jobmatching.config;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Indexes;
import org.bson.Document;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

@Component
public class MongoStartupInitializer implements ApplicationRunner {
    private static final String READY_STATUS = "READY";

    private final MongoDatabase database;

    public MongoStartupInitializer(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public void run(ApplicationArguments args) {
        database.runCommand(new Document("ping", 1));

        Set<String> existingCollections = listCollectionNames();
        ensureCollectionExists(existingCollections, MongoSchemaConstants.JOBS_COLLECTION);
        ensureCollectionExists(existingCollections, MongoSchemaConstants.CANDIDATES_COLLECTION);
        ensureCollectionExists(existingCollections, MongoSchemaConstants.MATCHES_COLLECTION);

        MongoCollection<Document> matchesCollection =
                database.getCollection(MongoSchemaConstants.MATCHES_COLLECTION);
        ensureMatchesIndexes(matchesCollection);

        validateRequiredVectorIndex(
                database.getCollection(MongoSchemaConstants.JOBS_COLLECTION),
                MongoSchemaConstants.JOBS_COLLECTION,
                MongoSchemaConstants.JOBS_VECTOR_INDEX);
        validateRequiredVectorIndex(
                database.getCollection(MongoSchemaConstants.CANDIDATES_COLLECTION),
                MongoSchemaConstants.CANDIDATES_COLLECTION,
                MongoSchemaConstants.CANDIDATES_VECTOR_INDEX);
    }

    private Set<String> listCollectionNames() {
        Set<String> collectionNames = new LinkedHashSet<>();
        try (MongoCursor<String> cursor = database.listCollectionNames().iterator()) {
            while (cursor.hasNext()) {
                collectionNames.add(cursor.next());
            }
        }
        return collectionNames;
    }

    private void ensureCollectionExists(Set<String> existingCollections, String collectionName) {
        if (!existingCollections.contains(collectionName)) {
            database.createCollection(collectionName);
            existingCollections.add(collectionName);
        }
    }

    private void ensureMatchesIndexes(MongoCollection<Document> matchesCollection) {
        matchesCollection.createIndex(Indexes.compoundIndex(
                Indexes.ascending("candidateId"),
                Indexes.descending("compositeScore"),
                Indexes.ascending("_id")));
        matchesCollection.createIndex(Indexes.compoundIndex(
                Indexes.ascending("jobId"),
                Indexes.descending("compositeScore"),
                Indexes.ascending("_id")));
    }

    private void validateRequiredVectorIndex(
            MongoCollection<Document> collection,
            String collectionName,
            String indexName) {
        Document index = findSearchIndexByName(collection, indexName);
        if (index == null) {
            throw missingIndexException(collectionName, indexName);
        }

        String status = index.getString("status");
        Boolean queryable = index.getBoolean("queryable");
        if (!READY_STATUS.equals(status) || !Boolean.TRUE.equals(queryable)) {
            throw new IllegalStateException(
                    "Atlas Vector Search index `" + indexName + "` on collection `"
                            + collectionName + "` is not queryable. Current status="
                            + String.valueOf(status) + ", queryable=" + String.valueOf(queryable)
                            + ". Create or fix it before starting the backend.");
        }
    }

    private Document findSearchIndexByName(MongoCollection<Document> collection, String indexName) {
        try (MongoCursor<Document> cursor = collection.listSearchIndexes().iterator()) {
            while (cursor.hasNext()) {
                Document index = cursor.next();
                if (indexName.equals(index.getString("name"))) {
                    return index;
                }
            }
        }
        return null;
    }

    private IllegalStateException missingIndexException(String collectionName, String indexName) {
        return new IllegalStateException(
                "Missing required Atlas Vector Search index `" + indexName
                        + "` on collection `" + collectionName
                        + "`. Create it before starting the backend.");
    }
}
