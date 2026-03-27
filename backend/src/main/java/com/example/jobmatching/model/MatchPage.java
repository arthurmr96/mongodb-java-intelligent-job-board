package com.example.jobmatching.model;

import org.bson.Document;

import java.util.List;

/**
 * Paginated response for match listings.
 *
 * @param items      current page of match results
 * @param nextCursor cursor for the next page, or {@code null} when exhausted
 */
public record MatchPage(List<Document> items, MatchCursor nextCursor) {
}
