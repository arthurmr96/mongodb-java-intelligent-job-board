package com.example.jobmatching.service;

import com.example.jobmatching.model.MatchCursor;
import com.example.jobmatching.model.MatchPage;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import org.bson.Document;
import org.bson.conversions.Bson;
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
    private static final int MAX_PAGE_SIZE = 50;

    // Composite score weights — must sum to 1.0
    private static final double VECTOR_WEIGHT = 0.7;
    private static final double SKILL_WEIGHT  = 0.3;

    private final MongoCollection<Document> candidatesCollection;
    private final MongoCollection<Document> jobsCollection;
    private final MongoCollection<Document> matchesCollection;

    public MatcherService(
            MongoCollection<Document> candidatesCollection,
            MongoCollection<Document> jobsCollection,
            MongoCollection<Document> matchesCollection) {
        this.candidatesCollection = candidatesCollection;
        this.jobsCollection = jobsCollection;
        this.matchesCollection = matchesCollection;
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
    public MatchPage findMatchingJobs(
            String candidateId,
            int limit,
            Double afterScore,
            String afterId)
            throws IOException, InterruptedException {
        int pageSize = validatePageSize(limit);
        ObjectId candidateObjectId = parseObjectId(candidateId, "candidateId");
        CursorState cursor = validateCursor(afterScore, afterId);

        Document candidate = candidatesCollection
                .find(new Document("_id", candidateObjectId))
                .first();

        if (candidate == null) {
            throw new IllegalArgumentException("Candidate not found: " + candidateId);
        }

        if (cursor != null) {
            return readCandidateMatchPage(candidateId, pageSize, cursor);
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
        int maxResults = safeCount(jobsCollection);
        List<Document> vectorResults = runVectorSearch(
                jobsCollection, queryVector, "jobs_vector_index", maxResults);

        // 4. Extract candidate skills for overlap scoring
        @SuppressWarnings("unchecked")
        List<Document> candidateSkillDocs = (List<Document>) candidate.getOrDefault("skills", List.of());
        Set<String> candidateSkillNames = candidateSkillDocs.stream()
                .map(s -> s.getString("name"))
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        List<Document> matches = scoreAndRankJobResults(
                vectorResults, candidateSkillNames, candidateId);

        saveMatchesForCandidate(candidateId, matches);
        return readCandidateMatchPage(candidateId, pageSize, cursor);
    }

    /**
     * Finds the top candidate matches for a given job posting.
     *
     * @param jobId the hex ObjectId string of the job document
     * @return ranked list of match result documents, ordered by compositeScore descending
     */
    public MatchPage findMatchingCandidates(
            String jobId,
            int limit,
            Double afterScore,
            String afterId)
            throws IOException, InterruptedException {
        int pageSize = validatePageSize(limit);
        ObjectId jobObjectId = parseObjectId(jobId, "jobId");
        CursorState cursor = validateCursor(afterScore, afterId);

        Document job = jobsCollection
                .find(new Document("_id", jobObjectId))
                .first();

        if (job == null) {
            throw new IllegalArgumentException("Job not found: " + jobId);
        }

        if (cursor != null) {
            return readJobMatchPage(jobId, pageSize, cursor);
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
        int maxResults = safeCount(candidatesCollection);
        List<Document> vectorResults = runVectorSearch(
                candidatesCollection, queryVector, "candidates_vector_index", maxResults);

        // 4. Extract required skills from the job
        @SuppressWarnings("unchecked")
        List<Document> requiredSkillDocs = (List<Document>) job.getOrDefault("requiredSkills", List.of());
        Set<String> requiredSkillNames = requiredSkillDocs.stream()
                .map(s -> s.getString("name"))
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        List<Document> matches = scoreAndRankCandidateResults(
                vectorResults, requiredSkillNames, jobId);

        saveMatchesForJob(jobId, matches);
        return readJobMatchPage(jobId, pageSize, cursor);
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
            String indexName,
            int limit) {
        if (limit <= 0) {
            return List.of();
        }

        // $vectorSearch stage — see Atlas docs for field definitions
        Document vectorSearchStage = new Document("$vectorSearch", new Document()
                .append("index", indexName)
                .append("path", "embedding")
                .append("queryVector", queryVector)
                .append("numCandidates", Math.max(limit * 10, limit))
                .append("limit", limit));

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

        scored.sort(MATCH_RESULT_ORDER);
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

        scored.sort(MATCH_RESULT_ORDER);
        return scored;
    }

    // ── Persistence ────────────────────────────────────────────────────────

    private static final Comparator<Document> MATCH_RESULT_ORDER =
            Comparator.comparingDouble(MatcherService::compositeScoreOf)
                    .reversed()
                    .thenComparing(doc -> doc.getString("jobId"), Comparator.nullsLast(String::compareTo))
                    .thenComparing(doc -> doc.getString("candidateId"), Comparator.nullsLast(String::compareTo));

    /**
     * Replaces all stored matches for a candidate with the freshly computed set.
     * Deletes the previous results first so stale entries from removed jobs are cleaned up.
     */
    private void saveMatchesForCandidate(String candidateId, List<Document> matches) {
        matchesCollection.deleteMany(Filters.eq("candidateId", candidateId));
        if (!matches.isEmpty()) {
            matchesCollection.insertMany(matches);
        }
    }

    /**
     * Replaces all stored matches for a job with the freshly computed set.
     * Deletes the previous results first so stale entries from removed candidates are cleaned up.
     */
    private void saveMatchesForJob(String jobId, List<Document> matches) {
        matchesCollection.deleteMany(Filters.eq("jobId", jobId));
        if (!matches.isEmpty()) {
            matchesCollection.insertMany(matches);
        }
    }

    private MatchPage readCandidateMatchPage(String candidateId, int limit, CursorState cursor) {
        return readMatchPage(Filters.eq("candidateId", candidateId), limit, cursor);
    }

    private MatchPage readJobMatchPage(String jobId, int limit, CursorState cursor) {
        return readMatchPage(Filters.eq("jobId", jobId), limit, cursor);
    }

    private MatchPage readMatchPage(Bson baseFilter, int limit, CursorState cursor) {
        List<Bson> filters = new ArrayList<>();
        filters.add(baseFilter);
        if (cursor != null) {
            filters.add(Filters.or(
                    Filters.lt("compositeScore", cursor.afterScore()),
                    Filters.and(
                            Filters.eq("compositeScore", cursor.afterScore()),
                            Filters.gt("_id", cursor.afterObjectId()))));
        }

        Bson query = filters.size() == 1 ? filters.getFirst() : Filters.and(filters);
        List<Document> items = new ArrayList<>();
        matchesCollection.find(query)
                .sort(Sorts.orderBy(
                        Sorts.descending("compositeScore"),
                        Sorts.ascending("_id")))
                .limit(limit + 1)
                .forEach(doc -> items.add(toResponseDocument(doc)));

        MatchCursor nextCursor = null;
        if (items.size() > limit) {
            Document lastVisible = items.get(limit - 1);
            nextCursor = new MatchCursor(lastVisible.getDouble("compositeScore"), lastVisible.getString("id"));
            items = new ArrayList<>(items.subList(0, limit));
        }
        if (items.isEmpty()) {
            return new MatchPage(items, null);
        }

        return new MatchPage(items, nextCursor);
    }

    private Document toResponseDocument(Document doc) {
        Document response = new Document(doc);
        ObjectId id = response.getObjectId("_id");
        if (id != null) {
            response.append("id", id.toHexString());
            response.remove("_id");
        }
        return response;
    }

    private int validatePageSize(int limit) {
        if (limit <= 0) {
            throw new IllegalArgumentException("limit must be at least 1");
        }
        if (limit > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("limit must be at most " + MAX_PAGE_SIZE);
        }
        return limit;
    }

    private ObjectId parseObjectId(String value, String fieldName) {
        try {
            return new ObjectId(value);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid ObjectId for " + fieldName + ": " + value);
        }
    }

    private CursorState validateCursor(Double afterScore, String afterId) {
        if (afterScore == null && afterId == null) {
            return null;
        }
        if (afterScore == null || afterId == null) {
            throw new IllegalArgumentException("afterScore and afterId must be provided together");
        }
        return new CursorState(afterScore, parseObjectId(afterId, "afterId"));
    }

    private static double compositeScoreOf(Document doc) {
        return doc.getDouble("compositeScore") != null ? doc.getDouble("compositeScore") : 0.0;
    }

    private int safeCount(MongoCollection<Document> collection) {
        long count = collection.countDocuments();
        if (count <= 0) {
            return 0;
        }
        return (int) Math.min(count, Integer.MAX_VALUE);
    }

    private record CursorState(double afterScore, ObjectId afterObjectId) {
    }
}
