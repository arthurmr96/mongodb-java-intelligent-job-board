const test = require('node:test');
const assert = require('node:assert/strict');

const { generateJobs } = require('./seed_jobs');

const SKILL_ALIASES = new Map([
  ['restful apis', 'rest apis'],
  ['rest api', 'rest apis'],
  ['graphql apis', 'graphql'],
  ['google cloud platform', 'gcp'],
  ['google cloud platform gcp', 'gcp'],
  ['k8s', 'kubernetes'],
  ['js', 'javascript'],
  ['node', 'node.js'],
]);

function normalizeSkillName(raw) {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9.+#/\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return SKILL_ALIASES.get(normalized) ?? normalized;
}

const TARGET_CANDIDATE_SKILLS = new Set([
  'TypeScript',
  'React',
  'Node.js',
  'PHP',
  'Google Cloud Platform (GCP)',
  'Blockchain (EVM, Solidity)',
  'SQL',
  'NoSQL',
  'Leadership',
  'Software Architecture',
  'JavaScript',
  'RESTful APIs',
  'Mobile Development (Ionic, Xamarin, Android)',
  'Git',
  'Team Collaboration',
  'Smart Contracts',
  'API Integration',
  'GraphQL',
  'MongoDB',
  'Java',
  'C#',
  'Next.js',
  'NestJS',
  'Python',
  'Docker',
  'Microservices',
  'Kubernetes',
  'Cloud Computing',
  'CI/CD',
  'Security Best Practices',
  'Rust',
  'DevOps',
  'Event-Driven Architecture',
  'Machine Learning',
  'TensorFlow',
  'AWS',
  'Data Science',
].map(normalizeSkillName));

function overlapFor(job) {
  const required = job.requiredSkills.map((skill) => normalizeSkillName(skill.name));
  const matched = required.filter((skill) => TARGET_CANDIDATE_SKILLS.has(skill));
  return matched.length / new Set(required).size;
}

test('seeded jobs cover high, medium, and low compatibility bands', () => {
  const jobs = generateJobs(200);
  const overlaps = jobs.map(overlapFor);

  const high = overlaps.filter((score) => score >= 0.9).length;
  const medium = overlaps.filter((score) => score >= 0.5 && score < 0.9).length;
  const low = overlaps.filter((score) => score < 0.5).length;

  assert.ok(high >= 1, `expected at least one high-compatibility job, found ${high}`);
  assert.ok(medium >= 40, `expected at least 40 medium-compatibility jobs, found ${medium}`);
  assert.ok(low >= 1, `expected at least one low-compatibility job, found ${low}`);
});
