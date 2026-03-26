package com.example.jobmatching.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A single skill entry on a candidate's profile.
 *
 * <p>All three fields are included in the candidate {@code embedText}:
 * <pre>
 *   Apache Kafka (Data Engineering, 4yr)
 * </pre>
 *
 * <p>{@code years} may be {@code null} when it cannot be inferred from the CV
 * (e.g., the candidate listed the skill without work history context).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Skill {

    /** The technology or skill name, e.g. "Apache Kafka". */
    private String name;

    /** The broader expertise area, e.g. "Data Engineering" or "Programming". */
    private String area;

    /** Estimated years of hands-on experience; may be null. */
    private Integer years;

    // ── Constructors ───────────────────────────────────────────────────────

    public Skill() {}

    public Skill(String name, String area, Integer years) {
        this.name = name;
        this.area = area;
        this.years = years;
    }

    // ── Getters & setters ──────────────────────────────────────────────────

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getArea() { return area; }
    public void setArea(String area) { this.area = area; }

    public Integer getYears() { return years; }
    public void setYears(Integer years) { this.years = years; }
}
