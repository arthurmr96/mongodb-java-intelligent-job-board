package com.example.jobmatching.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A required skill entry on a job posting.
 *
 * <p>Required skills are included in the job's {@code embedText} with a
 * minimum-years suffix:
 * <pre>
 *   Apache Kafka (Data Engineering, 3yr+)
 * </pre>
 *
 * <p>{@code minYears} may be {@code null} when the job posting does not
 * specify a minimum experience threshold.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RequiredSkill {

    /** The technology or skill name, e.g. "Apache Kafka". */
    private String name;

    /** The broader expertise area, e.g. "Data Engineering". */
    private String area;

    /** Minimum years of experience required; may be null. */
    private Integer minYears;

    // ── Constructors ───────────────────────────────────────────────────────

    public RequiredSkill() {}

    public RequiredSkill(String name, String area, Integer minYears) {
        this.name = name;
        this.area = area;
        this.minYears = minYears;
    }

    // ── Getters & setters ──────────────────────────────────────────────────

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getArea() { return area; }
    public void setArea(String area) { this.area = area; }

    public Integer getMinYears() { return minYears; }
    public void setMinYears(Integer minYears) { this.minYears = minYears; }
}
