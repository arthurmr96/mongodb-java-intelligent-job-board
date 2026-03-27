package com.example.jobmatching.service;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MatcherServiceTest {

    @Test
    void normalizeSkillNameMapsCommonAliases() {
        assertEquals("rest apis", MatcherService.normalizeSkillName("RESTful APIs"));
        assertEquals("rest apis", MatcherService.normalizeSkillName("REST API"));
        assertEquals("gcp", MatcherService.normalizeSkillName("Google Cloud Platform (GCP)"));
        assertEquals("kubernetes", MatcherService.normalizeSkillName("k8s"));
        assertEquals("node.js", MatcherService.normalizeSkillName("node"));
    }

    @Test
    void scoreAndRankJobResultsUsesAliasesWithoutLosingDisplayNames() throws Exception {
        MatcherService matcherService = new MatcherService(null, null, null);
        List<Document> jobResults = List.of(new Document()
                .append("_id", new ObjectId())
                .append("title", "Platform Engineer")
                .append("company", "Northstar Labs")
                .append("vectorScore", 0.82d)
                .append("requiredSkills", List.of(
                        new Document("name", "REST APIs"),
                        new Document("name", "MongoDB"),
                        new Document("name", "Node.js")
                )));

        Method method = MatcherService.class.getDeclaredMethod(
                "scoreAndRankJobResults", List.class, Set.class, String.class);
        method.setAccessible(true);

        @SuppressWarnings("unchecked")
        List<Document> ranked = (List<Document>) method.invoke(
                matcherService,
                jobResults,
                Set.of("rest apis", "mongodb", "node.js"),
                "candidate-1");

        Document result = ranked.getFirst();
        assertEquals(1.0d, result.getDouble("skillOverlapScore"));
        assertEquals(List.of("REST APIs", "MongoDB", "Node.js"), result.getList("matchedSkills", String.class));
        assertTrue(result.getList("missingSkills", String.class).isEmpty());
    }
}
