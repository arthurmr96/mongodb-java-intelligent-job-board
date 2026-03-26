# Intelligent Job Matching Platform

An AI-driven job matching platform that uses **VoyageAI embeddings** (via the MongoDB Atlas Embedding and Reranking REST API) and **MongoDB Atlas Vector Search** to match candidates with job postings based on semantic meaning and structured skill overlap — not keyword rules.

Built with **Java 21 + Spring Boot 3** on the backend and **React + Vite** on the frontend.

---

## What the app does

**Candidates** upload their CV PDF, review the AI-extracted profile, and see their top job matches ranked by composite score.

**Recruiters** upload a job posting PDF, review the extracted details, and see their best-fit candidates.

The PDF → auto-fill → review → save → embed pipeline ensures nothing is ever persisted automatically from a PDF. Extracted data always surfaces in an editable review form first.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3, Maven |
| Embeddings | Atlas Embedding and Reranking REST API (`voyage-4-large`) |
| Database | MongoDB Atlas (Java sync driver) |
| PDF parsing | Apache PDFBox 3 |
| LLM extraction | OpenAI-compatible chat completion API |
| Frontend | React 18, Vite, Tailwind CSS |
| Containerisation | Docker, Docker Compose |

---

## Prerequisites

- Java 21+
- Maven 3.9+
- Node 20+
- Docker + Docker Compose
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (free tier works)
- **MongoDB Atlas Vector Search indexes created for the `candidates` and `jobs` collections** (required for matching/search)
- An Atlas API key with access to the Embedding and Reranking API
- An OpenAI API key (or any OpenAI-compatible LLM endpoint)

---

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/your-org/intelligent-job-matching.git
cd intelligent-job-matching
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/...
VOYAGE_API_KEY=your_atlas_api_key
LLM_API_KEY=your_openai_api_key
```

### 3. Create Atlas Vector Search indexes

> **Required:** Matching relies on Atlas Vector Search. If you don’t create these indexes first, the app cannot run vector similarity queries and matching will fail.

In the Atlas UI, navigate to **Search Indexes → Create Vector Search Index** for each collection.

**candidates collection:**

```json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 1024,
    "similarity": "cosine"
  }]
}
```

Name this index `candidates_vector_index`.

**jobs collection** — same definition, named `jobs_vector_index`.

### 4. Start the app with Docker Compose

```bash
docker-compose up --build
```

Open [http://localhost](http://localhost) in your browser.

### 5. Seed sample candidates and job postings (optional)

```bash
node scripts/seed_candidates.js
node scripts/seed_jobs.js
```

Both seeders generate `200` records by default and accept overrides:

```bash
node scripts/seed_candidates.js --count 50 --api-url http://localhost:8080
node scripts/seed_jobs.js --count 75 --api-url http://localhost:8080
```

---

## Running without Docker

**Backend:**
```bash
cd backend
export MONGODB_URI=...
export VOYAGE_API_KEY=...
export LLM_API_KEY=...
mvn spring-boot:run
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` to `http://localhost:8080` (configured in `vite.config.js`).

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/candidates/parse-pdf` | Extract CV fields from PDF (returns review payload, nothing saved) |
| `POST` | `/candidates` | Save confirmed candidate + generate embedding |
| `GET` | `/candidates/:id` | Get candidate by ID |
| `GET` | `/candidates` | List active candidates |
| `POST` | `/jobs/parse-pdf` | Extract job fields from PDF (returns review payload, nothing saved) |
| `POST` | `/jobs` | Save confirmed job posting + generate embedding |
| `GET` | `/jobs/:id` | Get job posting by ID |
| `GET` | `/jobs` | List published job postings |
| `GET` | `/match/candidate/:id` | Get ranked job matches for a candidate |
| `GET` | `/match/job/:id` | Get ranked candidate matches for a job |

---

## Re-embedding after a model upgrade

When you upgrade the VoyageAI model, all documents must be re-embedded (embeddings from different models are not comparable). Because `embedText` is stored on every document, the `reembed.js` script handles this without re-running LLM extraction:

```bash
VOYAGE_API_KEY=... MONGODB_URI=... node scripts/reembed.js --model voyage-4-xl
```

---

## Project structure

```
intelligent-job-matching/
├── backend/
│   ├── src/main/java/com/example/jobmatching/
│   │   ├── JobMatchingApplication.java
│   │   ├── config/MongoConfig.java
│   │   ├── model/          CandidateProfile, Skill, JobPosting, RequiredSkill
│   │   ├── controller/     CandidateController, JobController, MatchingController
│   │   └── service/        PdfParserService, CvExtractorService, JobExtractorService,
│   │                        EmbedderService, MatcherService
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── pages/          CandidatePage, RecruiterPage
│   │   ├── components/     PdfUploadZone, CandidateReviewForm, JobReviewForm,
│   │   │                    MatchCard, SkillBadge
│   │   └── api/client.js
│   └── vite.config.js
├── scripts/
│   ├── seed_candidates.js
│   ├── seed_jobs.js
│   ├── seed_utils.js
│   └── reembed.js
├── docker-compose.yml
├── .env.example
└── README.md
```
