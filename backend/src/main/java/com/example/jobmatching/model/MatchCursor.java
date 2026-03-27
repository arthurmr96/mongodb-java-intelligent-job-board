package com.example.jobmatching.model;

/**
 * Cursor returned by paginated match endpoints.
 *
 * @param afterScore compositeScore of the last item in the current page
 * @param afterId    MongoDB ObjectId string of the last item in the current page
 */
public record MatchCursor(double afterScore, String afterId) {
}
