/**
 * API client for the Intelligent Job Matching backend.
 *
 * All requests are sent to the `/api` prefix, which Vite proxies to the
 * Spring Boot backend at http://localhost:8080 in development.
 * In production, the same path prefix is handled by the reverse proxy
 * (nginx / Docker Compose) in front of both services.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

// ── Shared helper ──────────────────────────────────────────────────────────

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json;
}

// ── Candidate endpoints ────────────────────────────────────────────────────

/**
 * Upload a CV PDF and receive a pre-filled CandidateProfile for review.
 * Nothing is written to MongoDB at this stage.
 *
 * @param {File} file the PDF file selected by the user
 * @returns {Promise<Object>} the pre-filled CandidateProfile JSON
 */
export async function parseCvPdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/candidates/parse-pdf`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(res);
}

/**
 * Save a confirmed CandidateProfile to MongoDB.
 * The backend will build the embedText, call the Atlas VoyageAI REST API,
 * and persist the document with the generated embedding.
 *
 * @param {Object} profile the confirmed (possibly user-edited) CandidateProfile
 * @returns {Promise<Object>} the persisted document including its MongoDB _id
 */
export async function saveCandidate(profile) {
  const res = await fetch(`${BASE_URL}/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  return handleResponse(res);
}

/**
 * Retrieve a single candidate by ObjectId.
 *
 * @param {string} id hex ObjectId string
 * @returns {Promise<Object>} the candidate document
 */
export async function getCandidate(id) {
  const res = await fetch(`${BASE_URL}/candidates/${id}`);
  return handleResponse(res);
}

/**
 * List active candidates (most recent first).
 *
 * @param {{ limit?: number, offset?: number }} params optional pagination params
 * @returns {Promise<Object[]>} array of candidate documents (embedding omitted)
 */
export async function listCandidates({ limit = 20, offset = 0 } = {}) {
  const res = await fetch(
    `${BASE_URL}/candidates?limit=${limit}&offset=${offset}`
  );
  return handleResponse(res);
}

// ── Job endpoints ──────────────────────────────────────────────────────────

/**
 * Upload a job posting PDF and receive a pre-filled JobPosting for review.
 * Nothing is written to MongoDB at this stage.
 *
 * @param {File} file the PDF file selected by the recruiter
 * @returns {Promise<Object>} the pre-filled JobPosting JSON
 */
export async function parseJobPdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/jobs/parse-pdf`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(res);
}

/**
 * Save a confirmed JobPosting to MongoDB with status "published".
 *
 * @param {Object} posting the confirmed (possibly recruiter-edited) JobPosting
 * @returns {Promise<Object>} the persisted document including its MongoDB _id
 */
export async function saveJob(posting) {
  const res = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(posting),
  });
  return handleResponse(res);
}

/**
 * Retrieve a single job posting by ObjectId.
 *
 * @param {string} id hex ObjectId string
 * @returns {Promise<Object>} the job posting document
 */
export async function getJob(id) {
  const res = await fetch(`${BASE_URL}/jobs/${id}`);
  return handleResponse(res);
}

/**
 * List published job postings (most recent first).
 *
 * @param {{ limit?: number, offset?: number }} params optional pagination params
 * @returns {Promise<Object[]>} array of job posting documents (embedding omitted)
 */
export async function listJobs({ limit = 20, offset = 0 } = {}) {
  const res = await fetch(`${BASE_URL}/jobs?limit=${limit}&offset=${offset}`);
  return handleResponse(res);
}

// ── Match endpoints ────────────────────────────────────────────────────────

/**
 * Retrieve ranked job matches for a candidate.
 * Uses the stored embedding — no re-embedding on the server.
 *
 * @param {string} candidateId hex ObjectId string
 * @returns {Promise<Object[]>} ranked match results with vectorScore, skillOverlapScore, compositeScore
 */
export async function getMatchesForCandidate(candidateId) {
  const res = await fetch(`${BASE_URL}/match/candidate/${candidateId}`);
  return handleResponse(res);
}

/**
 * Retrieve ranked candidate matches for a job posting.
 *
 * @param {string} jobId hex ObjectId string
 * @returns {Promise<Object[]>} ranked match results with vectorScore, skillOverlapScore, compositeScore
 */
export async function getMatchesForJob(jobId) {
  const res = await fetch(`${BASE_URL}/match/job/${jobId}`);
  return handleResponse(res);
}
