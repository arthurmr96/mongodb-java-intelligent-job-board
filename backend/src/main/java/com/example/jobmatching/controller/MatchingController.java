package com.example.jobmatching.controller;

import com.example.jobmatching.model.MatchPage;
import com.example.jobmatching.service.MatcherService;
import org.bson.Document;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

/**
 * REST controller for the matching pipeline.
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code GET /match/candidate/{id}} — returns the top job matches for a
 *       candidate, ranked by composite score.</li>
 *   <li>{@code GET /match/job/{id}} — returns the top candidate matches for a
 *       job posting, ranked by composite score.</li>
 * </ul>
 *
 * <h3>How matching works</h3>
 * <p>Both endpoints follow the same two-phase pipeline in {@link MatcherService}:
 * <ol>
 *   <li>Retrieve the stored {@code embedding} from the query document — no
 *       re-embedding is needed because the vector was generated and persisted
 *       at write time.</li>
 *   <li>Run a {@code $vectorSearch} aggregation via the MongoDB Java sync driver
 *       to find the top-N semantically similar documents in the opposite
 *       collection.</li>
 *   <li>Compute a {@code skillOverlapScore} for each result by comparing
 *       required vs. candidate skills.</li>
 *   <li>Combine scores: {@code compositeScore = 0.7 × vectorScore + 0.3 × skillOverlapScore}.</li>
 *   <li>Sort descending by {@code compositeScore} and return ranked results.</li>
 * </ol>
 */
@RestController
@RequestMapping("/match")
@CrossOrigin(origins = "*")
public class MatchingController {

    private final MatcherService matcherService;

    public MatchingController(MatcherService matcherService) {
        this.matcherService = matcherService;
    }

    /**
     * Returns the top job matches for the given candidate.
     *
     * <p>Each result document contains:
     * <ul>
     *   <li>{@code jobId}, {@code jobTitle}, {@code company}</li>
     *   <li>{@code vectorScore} — cosine similarity from Atlas Vector Search</li>
     *   <li>{@code skillOverlapScore} — fraction of required skills the candidate has</li>
     *   <li>{@code compositeScore} — weighted combination of the two signals</li>
     *   <li>{@code matchedSkills} — skills the candidate has that the job requires</li>
     *   <li>{@code missingSkills} — required skills the candidate lacks</li>
     * </ul>
     *
     * @param candidateId hex ObjectId string of the candidate
     * @return paginated job match results
     */
    @GetMapping("/candidate/{candidateId}")
    public ResponseEntity<?> matchForCandidate(
            @PathVariable String candidateId,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Double afterScore,
            @RequestParam(required = false) String afterId) {
        try {
            MatchPage matches = matcherService.findMatchingJobs(candidateId, limit, afterScore, afterId);
            return ResponseEntity.ok(matches);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.unprocessableEntity()
                    .body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Matching pipeline failed: " + e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Request interrupted"));
        }
    }

    /**
     * Returns the top candidate matches for the given job posting.
     *
     * <p>Each result document contains:
     * <ul>
     *   <li>{@code candidateId}, {@code candidateName}, {@code candidateEmail}</li>
     *   <li>{@code vectorScore}, {@code skillOverlapScore}, {@code compositeScore}</li>
     *   <li>{@code matchedSkills}, {@code missingSkills}</li>
     * </ul>
     *
     * @param jobId hex ObjectId string of the job posting
     * @return paginated candidate match results
     */
    @GetMapping("/job/{jobId}")
    public ResponseEntity<?> matchForJob(
            @PathVariable String jobId,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) Double afterScore,
            @RequestParam(required = false) String afterId) {
        try {
            MatchPage matches = matcherService.findMatchingCandidates(jobId, limit, afterScore, afterId);
            return ResponseEntity.ok(matches);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.unprocessableEntity()
                    .body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Matching pipeline failed: " + e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Request interrupted"));
        }
    }
}
