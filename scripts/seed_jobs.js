#!/usr/bin/env node
/**
 * seed_jobs.js
 *
 * Populates the `jobs` collection with sample job postings for local development
 * and demo purposes. Each posting is saved via the backend API (POST /jobs),
 * which means the embedText is built and the Atlas VoyageAI REST API is called
 * for each document — exactly the same pipeline as the UI flow.
 *
 * Prerequisites:
 *   - The backend must be running (default: http://localhost:8080)
 *   - MONGODB_URI, VOYAGE_API_KEY, and LLM_API_KEY must be set in the backend environment
 *
 * Usage:
 *   node scripts/seed_jobs.js
 *   node scripts/seed_jobs.js --api-url http://localhost:8080
 */

const API_URL = process.argv.includes('--api-url')
  ? process.argv[process.argv.indexOf('--api-url') + 1]
  : 'http://localhost:8080';

const SAMPLE_JOBS = [
  {
    title: 'Senior Data Engineer',
    company: 'TechCorp',
    location: 'Remote',
    remotePolicy: 'remote',
    seniority: 'senior',
    employmentType: 'full-time',
    salary: { min: 130000, max: 160000, currency: 'USD' },
    summary:
      'We are looking for a Senior Data Engineer to scale our event-driven platform. ' +
      'You will design and maintain real-time pipelines that process millions of events per day, ' +
      'working closely with our ML and analytics teams.',
    responsibilities: [
      'Design and maintain Apache Kafka event streaming pipelines',
      'Build Java-based ETL workflows and batch processing jobs',
      'Collaborate with data scientists to operationalise ML models',
      'Monitor pipeline performance and SLAs; on-call rotation',
      'Mentor junior engineers and conduct code reviews',
    ],
    requiredSkills: [
      { name: 'Apache Kafka', area: 'Data Engineering', minYears: 3 },
      { name: 'Java',         area: 'Programming',      minYears: 5 },
      { name: 'SQL',          area: 'Databases',        minYears: 4 },
    ],
    preferredSkills: [
      { name: 'MongoDB',      area: 'Databases' },
      { name: 'Spring Boot',  area: 'Frameworks' },
      { name: 'Kubernetes',   area: 'Infrastructure' },
    ],
    source: 'manual',
  },
  {
    title: 'Full-Stack Java Developer',
    company: 'FinStartup',
    location: 'New York, NY',
    remotePolicy: 'hybrid',
    seniority: 'mid',
    employmentType: 'full-time',
    salary: { min: 110000, max: 140000, currency: 'USD' },
    summary:
      'Join our fintech team building the next generation of payment infrastructure. ' +
      'You will own features end-to-end: Spring Boot microservices on the backend and ' +
      'React on the frontend.',
    responsibilities: [
      'Develop and test Spring Boot REST APIs consumed by web and mobile clients',
      'Build React UI components for our merchant dashboard',
      'Integrate with third-party payment APIs (Stripe, Plaid)',
      'Write unit and integration tests; maintain CI/CD pipelines',
    ],
    requiredSkills: [
      { name: 'Java',         area: 'Programming',  minYears: 3 },
      { name: 'Spring Boot',  area: 'Frameworks',   minYears: 2 },
      { name: 'React',        area: 'Frontend',     minYears: 2 },
      { name: 'PostgreSQL',   area: 'Databases',    minYears: 2 },
    ],
    preferredSkills: [
      { name: 'MongoDB',  area: 'Databases' },
      { name: 'Docker',   area: 'Infrastructure' },
    ],
    source: 'manual',
  },
  {
    title: 'Machine Learning Engineer',
    company: 'AI Labs',
    location: 'Remote',
    remotePolicy: 'remote',
    seniority: 'senior',
    employmentType: 'full-time',
    salary: { min: 150000, max: 190000, currency: 'USD' },
    summary:
      'We are building applied AI products at scale. As an ML Engineer you will take models ' +
      'from research to production, working on recommendation systems and NLP pipelines.',
    responsibilities: [
      'Train, evaluate, and deploy ML models to production',
      'Build feature engineering pipelines using Python and Spark',
      'Collaborate with researchers to implement novel architectures',
      'Monitor model performance and retrain on data drift',
    ],
    requiredSkills: [
      { name: 'Python',          area: 'Programming',     minYears: 4 },
      { name: 'PyTorch',         area: 'Machine Learning',minYears: 2 },
      { name: 'Apache Spark',    area: 'Data Engineering', minYears: 2 },
      { name: 'Vector databases',area: 'Databases',       minYears: 1 },
    ],
    preferredSkills: [
      { name: 'MongoDB Atlas Vector Search', area: 'Databases' },
      { name: 'Java', area: 'Programming' },
    ],
    source: 'manual',
  },
  {
    title: 'Backend Engineer — Java & Microservices',
    company: 'CloudPlatform Inc.',
    location: 'Austin, TX',
    remotePolicy: 'hybrid',
    seniority: 'mid',
    employmentType: 'full-time',
    salary: { min: 105000, max: 130000, currency: 'USD' },
    summary:
      'Build the microservices backbone of our SaaS platform. You will work in a small, ' +
      'autonomous team responsible for identity, billing, and notification services.',
    responsibilities: [
      'Design and implement RESTful microservices in Java 21 / Spring Boot 3',
      'Write comprehensive unit and contract tests',
      'Define and evolve MongoDB schemas for high-throughput services',
      'Participate in architecture discussions and RFCs',
    ],
    requiredSkills: [
      { name: 'Java',        area: 'Programming', minYears: 3 },
      { name: 'Spring Boot', area: 'Frameworks',  minYears: 2 },
      { name: 'MongoDB',     area: 'Databases',   minYears: 1 },
      { name: 'Docker',      area: 'Infrastructure', minYears: 1 },
    ],
    preferredSkills: [
      { name: 'Kubernetes', area: 'Infrastructure' },
      { name: 'Apache Kafka', area: 'Data Engineering' },
    ],
    source: 'manual',
  },
];

async function postJob(job) {
  const res = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /jobs failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function main() {
  console.log(`Seeding ${SAMPLE_JOBS.length} jobs via ${API_URL}/jobs …\n`);

  for (const job of SAMPLE_JOBS) {
    try {
      const saved = await postJob(job);
      console.log(`✓ [${saved.id}] ${job.title} @ ${job.company}`);
    } catch (err) {
      console.error(`✗ ${job.title}: ${err.message}`);
    }
  }

  console.log('\nDone. Check your Atlas cluster for the new documents.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
