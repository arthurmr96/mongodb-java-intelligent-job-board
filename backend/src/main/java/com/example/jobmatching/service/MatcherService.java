package com.example.jobmatching.service;

import com.example.jobmatching.model.RequiredSkill;
import com.example.jobmatching.model.Skill;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Runs the two-phase matching pipeline:
 * <ol>
 *   <li><b>Vector search</b> — uses the stored {@code embedding} field of the
 *       query document to run a {@code $vectorSearch} aggregation via the
 *       MongoDB Java sync driver, retrieving the top-N semantically similar
 *       documents from the opposite collection.</li>
 *   <li><b>Composite scoring</b> — for each vector search result, computes a
 *       structured {@code skillOverlapScore} and combines it with the vector
 *       score into a weighted {@code compositeScore}.</li>
 * </ol>
 *
 * <h3>Composite score formula</h3>
 * <pre>
 *   compositeScore = 0.7 × vectorScore + 0.3 × skillOverlapScore
 * </pre>
 *
 * <p>The 70/30 split gives semantic context the majority weight while ensuring
 * that candidates who literally lack required skills are penalised. The weights
 * can be tuned in {@link #VECTOR_WEIGHT} and {@link #SKILL_WEIGHT}.
 *
 * <h3>Vector Search index requirement</h3>
 * <p>Both {@code candidates} and {@code jobs} collections must have an Atlas
 * Vector Search index on the {@code embedding} field with:
 * <ul>
 *   <li>{@code numDimensions: 1024} (voyage-4-large output size)</li>
 *   <li>{@code similarity: "cosine"}</li>
 * </ul>
 */
@Service
public class MatcherService {

    // Composite score weights — must sum to 1.0
    private static final double VECTOR_WEIGHT = 0.7;
    private static final double SKILL_WEIGHT  = 0.3;

    // Number of candidates / jobs to retrieve from vector search
    private static final int NUM_CANDIDATES = 10;

    private final MongoCollection<Document> candidatesCollection;
    private final MongoCollection<Document> jobsCollection;
    private final MongoCollection<Document> matchesCollection;
    private final EmbedderService embedderService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MatcherService(
            MongoCollection<Document> candidatesCollection,
            MongoCollection<Document> jobsCollection,
            MongoCollection<Document> matchesCollection,
            EmbedderService embedderService) {
        this.candidatesCollection = candidatesCollection;
        this.jobsCollection = jobsCollection;
        this.matchesCollection = matchesCollection;
        this.embedderService = embedderService;
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Finds the top job matches for a given candidate.
     *
     * <p>Retrieves the candidate's stored {@code embedding} (no re-embedding),
     * runs {@code $vectorSearch} against the {@code jobs} collection, computes
     * composite scores, caches results in the {@code matches} collection, and
     * returns a ranked list.
     *
     * @param candidateId the hex ObjectId string of the candidate document
     * @return ranked list of match result documents, ordered by compositeScore descending
     * @throws IOException          if the embedder or MongoDB call fails
     * @throws InterruptedException if interrupted during embedding
     */
    public List<Document> findMatchingJobs(String candidateId)
            throws IOException, InterruptedException {

        // 1. Fetch candidate document
        Document candidate = candidatesCollection
                .find(new Document("_id", new ObjectId(candidateId)))
                .first();

        if (candidate == null) {
            throw new IllegalArgumentException("Candidate not found: " + candidateId);
        }

        // 2. Use the stored embedding — no re-embedding needed
        @SuppressWarnings("unchecked")
        List<Double> queryVector = (List<Double>) candidate.get("embedding");

        if (queryVector == null || queryVector.isEmpty()) {
            throw new IllegalStateException(
                "Candidate " + candidateId + " has no embedding. "
                + "Ensure the candidate was saved through POST /candidates.");
        }

        // 3. Run $vectorSearch against jobs collection
        List<Document> vectorResults = runVectorSearch(jobsCollection, queryVector, "jobs_vector_index");

        // 4. Extract candidate skills for overlap scoring
        @SuppressWarnings("unchecked")
        List<Document> candidateSkillDocs = (List<Document>) candidate.getOrDefault("skills", List.of());
        Set<String> candidateSkillNames = candidateSkillDocs.stream()
                .map(s -> s.getString("name"))
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        // 5. Score and rank results
        List<Document> matches = scoreAndRankJobResults(
                vectorResults, candidateSkillNames, candidateId);

        // 6. Cache results in the matches collection
        cacheMatches(matches);

        return matches;
    }

    /**
     * Finds the top candidate matches for a given job posting.
     *
     * @param jobId the hex ObjectId string of the job document
     * @return ranked list of match result documents, ordered by compositeScore descending
     */
    public List<Document> findMatchingCandidates(String jobId)
            throws IOException, InterruptedException {

        // 1. Fetch job document
        Document job = jobsCollection
                .find(new Document("_id", new ObjectId(jobId)))
                .first();

        if (job == null) {
            throw new IllegalArgumentException("Job not found: " + jobId);
        }

        // 2. Use the stored embedding
        @SuppressWarnings("unchecked")
        List<Double> queryVector = (List<Double>) job.get("embedding");

        if (queryVector == null || queryVector.isEmpty()) {
            throw new IllegalStateException(
                "Job " + jobId + " has no embedding. "
                + "Ensure the job was saved through POST /jobs.");
        }

        // 3. Run $vectorSearch against candidates collection
        List<Document> vectorResults = runVectorSearch(
                candidatesCollection, queryVector, "candidates_vector_index");

        // 4. Extract required skills from the job
        @SuppressWarnings("unchecked")
        List<Document> requiredSkillDocs = (List<Document>) job.getOrDefault("requiredSkills", List.of());
        Set<String> requiredSkillNames = requiredSkillDocs.stream()
                .map(s -> s.getString("name"))
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        // 5. Score and rank results
        List<Document> matches = scoreAndRankCandidateResults(
                vectorResults, requiredSkillNames, jobId);

        // 6. Cache results
        cacheMatches(matches);

        return matches;
    }

    // ── $vectorSearch ──────────────────────────────────────────────────────

    /**
     * Runs a {@code $vectorSearch} aggregation stage against the given collection.
     *
     * <p>The aggregation pipeline:
     * <ol>
     *   <li>{@code $vectorSearch} — ANN search returning the top N results with
     *       a {@code vectorSearchScore} metadata field.</li>
     *   <li>{@code $addFields} — promotes the score from metadata into the
     *       document so downstream stages can read it.</li>
     * </ol>
     *
     * <p>The {@code index} parameter must match the name of the Atlas Vector
     * Search index created on the collection (e.g. {@code "candidates_vector_index"}).
     *
     * @param collection  the collection to search
     * @param queryVector the query embedding (1 024 floats)
     * @param indexName   the Atlas Vector Search index name
     * @return the raw aggregation result documents (no scoring yet)
     */
    private List<Document> runVectorSearch(
            MongoCollection<Document> collection,
            List<Double> queryVector,
            String indexName) {

        // $vectorSearch stage — see Atlas docs for field definitions
        Document vectorSearchStage = new Document("$vectorSearch", new Document()
                .append("index", indexName)
                .append("path", "embedding")
                .append("queryVector", queryVector)
                .append("numCandidates", NUM_CANDIDATES * 10) // oversample for better recall
                .append("limit", NUM_CANDIDATES));

        // Promote the vector score into a top-level field
        Document addFieldsStage = new Document("$addFields", new Document(
                "vectorScore", new Document("$meta", "vectorSearchScore")));

        List<Document> pipeline = List.of(vectorSearchStage, addFieldsStage);

        List<Document> results = new ArrayList<>();
        try (MongoCursor<Document> cursor = collection.aggregate(pipeline).iterator()) {
            while (cursor.hasNext()) {
                results.add(cursor.next());
            }
        }
        return results;
    }

    // ── Scoring ────────────────────────────────────────────────────────────

    /**
     * For each vector search result (a job document), computes the skill overlap
     * and composite score relative to the given candidate, then sorts descending.
     */
    private List<Document> scoreAndRankJobResults(
            List<Document> jobResults,
            Set<String> candidateSkillNames,
            String candidateId) {

        List<Document> scored = new ArrayList<>();

        for (Document job : jobResults) {
            @SuppressWarnings("unchecked")
            List<Document> requiredSkillDocs = (List<Document>) job.getOrDefault("requiredSkills", List.of());

            Set<String> requiredNames = requiredSkillDocs.stream()
                    .map(s -> s.getString("name"))
                    .filter(Objects::nonNull)
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());

            List<String> matched = new ArrayList<>();
            List<String> missing = new ArrayList<>();

            for (Document req : requiredSkillDocs) {
                String name = req.getString("name");
                if (name == null) continue;
                if (candidateSkillNames.contains(name.toLowerCase())) {
                    matched.add(name);
                } else {
                    missing.add(name);
                }
            }

            double skillOverlapScore = requiredNames.isEmpty() ? 1.0
                    : (double) matched.size() / requiredNames.size();

            double vectorScore = job.getDouble("vectorScore") != null
                    ? job.getDouble("vectorScore") : 0.0;

            double compositeScore = VECTOR_WEIGHT * vectorScore
                    + SKILL_WEIGHT * skillOverlapScore;

            String jobId = job.getObjectId("_id").toHexString();

            Document result = new Document()
                    .append("candidateId", candidateId)
                    .append("jobId", jobId)
                    .append("jobTitle", job.getString("title"))
                    .append("company", job.getString("company"))
                    .append("vectorScore", vectorScore)
                    .append("skillOverlapScore", skillOverlapScore)
                    .append("compositeScore", compositeScore)
                    .append("matchedSkills", matched)
                    .append("missingSkills", missing)
                    .append("matchedAt", Instant.now().toString());

            scored.add(result);
        }

        scored.sort(Comparator.comparingDouble(
                d -> -((Document) d).getDouble("compositeScore")));
        return scored;
    }

    /**
     * For each vector search result (a candidate document), computes the skill
     * overlap and composite score relative to the given job, then sorts descending.
     */
    private List<Document> scoreAndRankCandidateResults(
            List<Document> candidateResults,
            Set<String> requiredSkillNames,
            String jobId) {

        List<Document> scored = new ArrayList<>();

        for (Document candidate : candidateResults) {
            @SuppressWarnings("unchecked")
            List<Document> skillDocs = (List<Document>) candidate.getOrDefault("skills", List.of());

            Set<String> candidateSkillNames = skillDocs.stream()
                    .map(s -> s.getString("name"))
                    .filter(Objects::nonNull)
                    .map(String::toLowerCase)
                    .collect(Collectors.toSet());

            List<String> matched = new ArrayList<>();
            List<String> missing = new ArrayList<>();

            for (String req : requiredSkillNames) {
                if (candidateSkillNames.contains(req)) {
                    // Find the original-case skill name for display
                    skillDocs.stream()
                            .filter(s -> req.equalsIgnoreCase(s.getString("name")))
                            .findFirst()
                            .ifPresent(s -> matched.add(s.getString("name")));
                } else {
                    missing.add(req);
                }
            }

            double skillOverlapScore = requiredSkillNames.isEmpty() ? 1.0
                    : (double) matched.size() / requiredSkillNames.size();

            double vectorScore = candidate.getDouble("vectorScore") != null
                    ? candidate.getDouble("vectorScore") : 0.0;

            double compositeScore = VECTOR_WEIGHT * vectorScore
                    + SKILL_WEIGHT * skillOverlapScore;

            String candidateId = candidate.getObjectId("_id").toHexString();

            Document result = new Document()
                    .append("candidateId", candidateId)
                    .append("jobId", jobId)
                    .append("candidateName", candidate.getString("name"))
                    .append("candidateEmail", candidate.getString("email"))
                    .append("vectorScore", vectorScore)
                    .append("skillOverlapScore", skillOverlapScore)
                    .append("compositeScore", compositeScore)
                    .append("matchedSkills", matched)
                    .append("missingSkills", missing)
                    .append("matchedAt", Instant.now().toString());

            scored.add(result);
        }

        scored.sort(Comparator.comparingDouble(
                d -> -((Document) d).getDouble("compositeScore")));
        return scored;
    }

    // ── Cache ──────────────────────────────────────────────────────────────

    /**
     * Persists match results to the {@code matches} collection.
     * Existing matches for the same candidate/job pair are replaced (upsert).
     */
    private void cacheMatches(List<Document> matches) {
        for (Document match : matches) {
            Document filter = new Document()
                    .append("candidateId", match.get("candidateId"))
                    .append("jobId", match.get("jobId"));

            matchesCollection.replaceOne(
                    filter,
                    match,
                    new com.mongodb.client.model.ReplaceOptions().upsert(true));
        }
    }
}
