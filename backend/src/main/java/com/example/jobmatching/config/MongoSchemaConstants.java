package com.example.jobmatching.config;

public final class MongoSchemaConstants {
    public static final String CANDIDATES_COLLECTION = "candidates";
    public static final String JOBS_COLLECTION = "jobs";
    public static final String MATCHES_COLLECTION = "matches";

    public static final String CANDIDATES_VECTOR_INDEX = "candidates_vector_index";
    public static final String JOBS_VECTOR_INDEX = "jobs_vector_index";

    private MongoSchemaConstants() {
    }
}
