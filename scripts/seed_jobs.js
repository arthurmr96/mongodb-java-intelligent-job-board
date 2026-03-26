#!/usr/bin/env node
/**
 * seed_jobs.js
 *
 * Generates a batch of realistic job postings from a handful of domain
 * templates, varying company, title, location, salary, responsibilities,
 * and skill mixes in deterministic loops.
 *
 * Usage:
 *   node scripts/seed_jobs.js
 *   node scripts/seed_jobs.js --count 50
 *   node scripts/seed_jobs.js --api-url http://localhost:8080
 */

const {
  parseArgs,
  seedCollection,
  pickVariant,
  createDeterministicShuffle,
} = require('./seed_utils');

const LOCATIONS = [
  'Remote',
  'New York, NY',
  'Austin, TX',
  'San Francisco, CA',
  'Seattle, WA',
  'Chicago, IL',
  'Denver, CO',
  'Boston, MA',
  'Atlanta, GA',
  'Toronto, ON',
];

const COMPANY_PREFIXES = [
  'Northstar', 'BluePeak', 'Riverline', 'Signal', 'BrightForge',
  'CloudPath', 'Everfield', 'Atlas', 'Cedar', 'Lattice',
];

const COMPANY_SUFFIXES = [
  'Labs', 'Systems', 'Health', 'Finance', 'Analytics',
  'Cloud', 'Works', 'Platform', 'Networks', 'Software',
];

const JOB_ARCHETYPES = [
  {
    key: 'data',
    titles: ['Data Engineer', 'Senior Data Engineer', 'Streaming Data Engineer'],
    remotePolicies: ['remote', 'hybrid'],
    employmentTypes: ['full-time'],
    seniorities: ['mid', 'senior'],
    salaryBase: { min: 120000, max: 155000 },
    summaryTemplates: [
      'Join our data platform team to build batch and streaming pipelines that power analytics and machine learning use cases.',
      'We are scaling our event-driven data stack and need an engineer who can own ingestion, transformation, and reliability.',
      'This role partners with analytics and ML teams to deliver trustworthy, well-modeled data products at scale.',
    ],
    responsibilities: [
      'Design and maintain event ingestion and batch processing pipelines',
      'Build reliable transformations and quality checks for critical datasets',
      'Collaborate with analysts and ML teams on data modeling and delivery',
      'Improve orchestration, monitoring, and operational readiness for pipelines',
      'Contribute to reviews, runbooks, and incident response processes',
    ],
    requiredSkillPool: [
      { name: 'Apache Kafka', area: 'Data Engineering', baseYears: 3 },
      { name: 'Python', area: 'Programming', baseYears: 3 },
      { name: 'SQL', area: 'Databases', baseYears: 4 },
      { name: 'Apache Spark', area: 'Data Engineering', baseYears: 2 },
      { name: 'Airflow', area: 'Data Engineering', baseYears: 2 },
    ],
    preferredSkillPool: [
      { name: 'MongoDB', area: 'Databases' },
      { name: 'dbt', area: 'Analytics Engineering' },
      { name: 'Kubernetes', area: 'Infrastructure' },
    ],
  },
  {
    key: 'backend',
    titles: ['Backend Engineer - Java & Microservices', 'Java Platform Engineer', 'Senior Backend Engineer'],
    remotePolicies: ['hybrid', 'remote', 'on-site'],
    employmentTypes: ['full-time'],
    seniorities: ['mid', 'senior'],
    salaryBase: { min: 110000, max: 145000 },
    summaryTemplates: [
      'Build the backend foundation of our product with Java services, strong APIs, and a focus on operability.',
      'You will help evolve a microservices platform used by multiple product teams, balancing feature work and reliability.',
      'This role suits an engineer who enjoys service design, integration work, and performance-minded backend development.',
    ],
    responsibilities: [
      'Design and implement Spring Boot services and supporting APIs',
      'Model application data and evolve integrations with internal consumers',
      'Write unit, integration, and contract tests for backend changes',
      'Improve observability, incident readiness, and service performance',
      'Participate in architecture discussions and code reviews',
    ],
    requiredSkillPool: [
      { name: 'Java', area: 'Programming', baseYears: 3 },
      { name: 'Spring Boot', area: 'Frameworks', baseYears: 2 },
      { name: 'REST APIs', area: 'Backend', baseYears: 2 },
      { name: 'MongoDB', area: 'Databases', baseYears: 1 },
      { name: 'Docker', area: 'Infrastructure', baseYears: 1 },
    ],
    preferredSkillPool: [
      { name: 'Apache Kafka', area: 'Data Engineering' },
      { name: 'Kubernetes', area: 'Infrastructure' },
      { name: 'React', area: 'Frontend' },
    ],
  },
  {
    key: 'ml',
    titles: ['Machine Learning Engineer', 'Applied ML Engineer', 'Senior ML Engineer'],
    remotePolicies: ['remote', 'hybrid'],
    employmentTypes: ['full-time', 'contract'],
    seniorities: ['mid', 'senior'],
    salaryBase: { min: 140000, max: 180000 },
    summaryTemplates: [
      'Help us productionise ML systems, improve model quality, and build the data and inference workflows behind AI features.',
      'You will partner with product and data teams to ship recommendation and NLP models that are observable and reliable.',
      'This role covers experimentation, feature engineering, deployment, and monitoring for production machine learning.',
    ],
    responsibilities: [
      'Train, evaluate, and deploy machine learning models into production',
      'Build feature pipelines and support repeatable experimentation workflows',
      'Collaborate with software engineers on inference services and integrations',
      'Monitor model quality, latency, and drift with clear operational ownership',
      'Document tradeoffs and improve ML development standards across the team',
    ],
    requiredSkillPool: [
      { name: 'Python', area: 'Programming', baseYears: 4 },
      { name: 'PyTorch', area: 'Machine Learning', baseYears: 2 },
      { name: 'Feature Engineering', area: 'Machine Learning', baseYears: 2 },
      { name: 'MLOps', area: 'Machine Learning', baseYears: 1 },
      { name: 'Vector databases', area: 'Databases', baseYears: 1 },
    ],
    preferredSkillPool: [
      { name: 'MongoDB Atlas Vector Search', area: 'Databases' },
      { name: 'Apache Spark', area: 'Data Engineering' },
      { name: 'AWS', area: 'Cloud' },
    ],
  },
  {
    key: 'frontend',
    titles: ['Frontend Engineer', 'Full-Stack JavaScript Engineer', 'Senior React Engineer'],
    remotePolicies: ['remote', 'hybrid'],
    employmentTypes: ['full-time'],
    seniorities: ['mid', 'senior'],
    salaryBase: { min: 105000, max: 140000 },
    summaryTemplates: [
      'Build polished product experiences with React, strong API integration, and attention to performance and accessibility.',
      'We need an engineer who can ship frontend features end-to-end and collaborate closely with design and backend teams.',
      'This role focuses on reusable UI systems, product delivery, and thoughtful client-side architecture.',
    ],
    responsibilities: [
      'Build and maintain React interfaces for customer-facing workflows',
      'Collaborate with product and design on interaction patterns and UX quality',
      'Integrate frontend experiences with backend APIs and asynchronous data flows',
      'Add automated tests and improve performance, accessibility, and maintainability',
      'Contribute to reusable components and shared engineering standards',
    ],
    requiredSkillPool: [
      { name: 'React', area: 'Frontend', baseYears: 3 },
      { name: 'JavaScript', area: 'Programming', baseYears: 3 },
      { name: 'TypeScript', area: 'Programming', baseYears: 2 },
      { name: 'CSS', area: 'Frontend', baseYears: 2 },
      { name: 'REST APIs', area: 'Frontend', baseYears: 2 },
    ],
    preferredSkillPool: [
      { name: 'Node.js', area: 'Backend' },
      { name: 'Testing Library', area: 'Frontend' },
      { name: 'MongoDB', area: 'Databases' },
    ],
  },
  {
    key: 'devops',
    titles: ['DevOps Engineer', 'Cloud Platform Engineer', 'Senior Site Reliability Engineer'],
    remotePolicies: ['remote', 'hybrid', 'on-site'],
    employmentTypes: ['full-time'],
    seniorities: ['mid', 'senior'],
    salaryBase: { min: 125000, max: 165000 },
    summaryTemplates: [
      'Join our platform team to improve deployment safety, infrastructure automation, and service reliability.',
      'We are looking for an engineer who can evolve our cloud foundation and make delivery faster and more predictable.',
      'This role blends infrastructure as code, observability, and developer platform work across a growing engineering team.',
    ],
    responsibilities: [
      'Automate infrastructure provisioning and deployment workflows',
      'Operate Kubernetes and container tooling used by engineering teams',
      'Improve monitoring, alerting, and incident response practices',
      'Work with developers to improve reliability, security, and cost efficiency',
      'Document platform patterns and operational best practices',
    ],
    requiredSkillPool: [
      { name: 'AWS', area: 'Cloud', baseYears: 3 },
      { name: 'Docker', area: 'Infrastructure', baseYears: 2 },
      { name: 'Kubernetes', area: 'Infrastructure', baseYears: 2 },
      { name: 'Terraform', area: 'Infrastructure', baseYears: 2 },
      { name: 'CI/CD', area: 'Infrastructure', baseYears: 3 },
    ],
    preferredSkillPool: [
      { name: 'Linux', area: 'Infrastructure' },
      { name: 'MongoDB', area: 'Databases' },
      { name: 'Apache Kafka', area: 'Data Engineering' },
    ],
  },
];

function buildCompany(index) {
  return `${pickVariant(COMPANY_PREFIXES, index)} ${pickVariant(COMPANY_SUFFIXES, index, Math.floor(index / COMPANY_PREFIXES.length))}`;
}

function buildSalary(archetype, index) {
  const bandOffset = (index % 5) * 5000;
  return {
    min: archetype.salaryBase.min + bandOffset,
    max: archetype.salaryBase.max + bandOffset,
    currency: 'USD',
  };
}

function buildRequiredSkills(archetype, index) {
  const selected = createDeterministicShuffle(archetype.requiredSkillPool, index).slice(0, 3 + (index % 2));
  const seniorityBoost = Math.floor(index / JOB_ARCHETYPES.length) % 2;

  return selected.map((skill, skillIndex) => ({
    name: skill.name,
    area: skill.area,
    minYears: skill.baseYears + seniorityBoost + (skillIndex === 0 ? 1 : 0),
  }));
}

function buildPreferredSkills(archetype, index) {
  return createDeterministicShuffle(archetype.preferredSkillPool, index).slice(0, 2 + (index % 2)).map((skill) => ({
    name: skill.name,
    area: skill.area,
  }));
}

function buildResponsibilities(archetype, index) {
  return createDeterministicShuffle(archetype.responsibilities, index).slice(0, 4 + (index % 2));
}

function buildSummary(archetype, index, requiredSkills) {
  const base = pickVariant(archetype.summaryTemplates, index);
  const focus = requiredSkills.slice(0, 3).map((skill) => skill.name).join(', ');
  return `${base} You will work with technologies such as ${focus} while partnering closely with cross-functional teams.`;
}

function buildJob(archetype, index) {
  const requiredSkills = buildRequiredSkills(archetype, index);

  return {
    title: pickVariant(archetype.titles, index),
    company: buildCompany(index + archetype.key.length),
    location: pickVariant(LOCATIONS, index, archetype.key.length),
    remotePolicy: pickVariant(archetype.remotePolicies, index),
    seniority: pickVariant(archetype.seniorities, index),
    employmentType: pickVariant(archetype.employmentTypes, index),
    salary: buildSalary(archetype, index),
    summary: buildSummary(archetype, index, requiredSkills),
    responsibilities: buildResponsibilities(archetype, index),
    requiredSkills,
    preferredSkills: buildPreferredSkills(archetype, index),
    source: 'manual',
  };
}

function generateJobs(count) {
  return Array.from({ length: count }, (_, index) => {
    const archetype = JOB_ARCHETYPES[index % JOB_ARCHETYPES.length];
    return buildJob(archetype, index);
  });
}

async function main() {
  const { apiUrl, count } = parseArgs(process.argv);
  const jobs = generateJobs(count);

  await seedCollection({
    apiUrl,
    path: '/jobs',
    items: jobs,
    label: 'jobs',
    describeItem: (saved, job) => {
      const id = saved?.id ? `[${saved.id}] ` : '';
      return `${id}${job.title} @ ${job.company}`;
    },
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  generateJobs,
};
