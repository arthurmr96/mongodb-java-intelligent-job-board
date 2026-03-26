#!/usr/bin/env node
/**
 * seed_candidates.js
 *
 * Generates a batch of realistic candidate profiles by starting from a few
 * profile archetypes and creating deterministic variations in loops.
 *
 * Usage:
 *   node scripts/seed_candidates.js
 *   node scripts/seed_candidates.js --count 50
 *   node scripts/seed_candidates.js --api-url http://localhost:8080 --count 200
 */

const {
  parseArgs,
  seedCollection,
  pickVariant,
  createDeterministicShuffle,
} = require('./seed_utils');

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Cameron',
  'Sofia', 'Mateo', 'Priya', 'Nina', 'Lucas', 'Helena', 'Ethan', 'Isabella',
  'Noah', 'Maya', 'Daniel', 'Chloe', 'Gabriel', 'Layla', 'Samuel', 'Elena',
];

const LAST_NAMES = [
  'Nguyen', 'Silva', 'Patel', 'Johnson', 'Kim', 'Martinez', 'Brown', 'Santos',
  'Carter', 'Gonzalez', 'Singh', 'Walker', 'Costa', 'Reed', 'Almeida', 'Bennett',
  'Ramos', 'Parker', 'Mendes', 'Cook', 'Barbosa', 'Price', 'Dias', 'Ward',
];

const CITIES = [
  'Remote',
  'New York, NY',
  'Austin, TX',
  'Seattle, WA',
  'San Francisco, CA',
  'Chicago, IL',
  'Denver, CO',
  'Boston, MA',
  'Atlanta, GA',
  'Toronto, ON',
];

const EDUCATION_POOL = {
  backend: [
    { degree: 'B.S. Computer Science', institution: 'University of Texas', year: 2016 },
    { degree: 'B.Eng. Software Engineering', institution: 'McGill University', year: 2015 },
    { degree: 'B.S. Information Systems', institution: 'Georgia Tech', year: 2017 },
  ],
  data: [
    { degree: 'M.S. Data Engineering', institution: 'Northeastern University', year: 2018 },
    { degree: 'B.S. Computer Engineering', institution: 'University of Waterloo', year: 2016 },
    { degree: 'B.S. Applied Mathematics', institution: 'University of Illinois', year: 2014 },
  ],
  ml: [
    { degree: 'M.S. Machine Learning', institution: 'Carnegie Mellon University', year: 2019 },
    { degree: 'B.S. Computer Science', institution: 'University of Washington', year: 2017 },
    { degree: 'M.S. Artificial Intelligence', institution: 'University of Toronto', year: 2018 },
  ],
  frontend: [
    { degree: 'B.Des. Digital Media', institution: 'Parsons School of Design', year: 2017 },
    { degree: 'B.S. Computer Science', institution: 'University of British Columbia', year: 2016 },
    { degree: 'B.S. Human-Computer Interaction', institution: 'Indiana University', year: 2018 },
  ],
  devops: [
    { degree: 'B.S. Computer Networks', institution: 'Purdue University', year: 2015 },
    { degree: 'B.S. Computer Science', institution: 'Arizona State University', year: 2016 },
    { degree: 'B.S. Information Technology', institution: 'Rochester Institute of Technology', year: 2014 },
  ],
};

const CANDIDATE_ARCHETYPES = [
  {
    key: 'backend',
    headline: 'Senior Java Backend Engineer',
    summaryTemplates: [
      'Backend engineer focused on Java microservices, resilient APIs, and operational excellence in cloud environments.',
      'Java platform engineer who builds Spring Boot services, improves observability, and mentors teams on service design.',
      'Hands-on backend developer with experience modernising monoliths into event-driven Java services backed by MongoDB.',
    ],
    skillPool: [
      { name: 'Java', area: 'Programming', baseYears: 6 },
      { name: 'Spring Boot', area: 'Frameworks', baseYears: 4 },
      { name: 'MongoDB', area: 'Databases', baseYears: 3 },
      { name: 'Docker', area: 'Infrastructure', baseYears: 3 },
      { name: 'REST APIs', area: 'Backend', baseYears: 5 },
      { name: 'Apache Kafka', area: 'Data Engineering', baseYears: 2 },
      { name: 'Kubernetes', area: 'Infrastructure', baseYears: 2 },
    ],
    experienceTemplates: [
      {
        company: 'CloudCore Systems',
        title: 'Senior Backend Engineer',
        description: 'Built Spring Boot services, improved API latency, and introduced better monitoring for production workloads.',
      },
      {
        company: 'LedgerPath',
        title: 'Java Software Engineer',
        description: 'Implemented domain APIs, asynchronous workflows, and data access patterns for high-throughput products.',
      },
      {
        company: 'ScaleOps',
        title: 'Platform Engineer',
        description: 'Worked on deployment pipelines, service reliability, and schema evolution across shared backend services.',
      },
    ],
    certifications: ['Oracle Java SE Developer', 'MongoDB Associate Developer', 'AWS Certified Developer'],
  },
  {
    key: 'data',
    headline: 'Data Engineer',
    summaryTemplates: [
      'Data engineer specialising in streaming pipelines, warehouse modeling, and reliable batch processing for analytics teams.',
      'Engineer with a background in ETL, event ingestion, and SQL optimization across analytics and machine learning workloads.',
      'Hands-on builder of Kafka and Spark pipelines with a focus on quality checks, observability, and data contracts.',
    ],
    skillPool: [
      { name: 'Python', area: 'Programming', baseYears: 5 },
      { name: 'SQL', area: 'Databases', baseYears: 5 },
      { name: 'Apache Spark', area: 'Data Engineering', baseYears: 3 },
      { name: 'Apache Kafka', area: 'Data Engineering', baseYears: 3 },
      { name: 'Airflow', area: 'Data Engineering', baseYears: 3 },
      { name: 'MongoDB', area: 'Databases', baseYears: 2 },
      { name: 'dbt', area: 'Analytics Engineering', baseYears: 2 },
    ],
    experienceTemplates: [
      {
        company: 'Northstar Analytics',
        title: 'Data Engineer',
        description: 'Maintained ingestion pipelines, transformed large event datasets, and supported BI and ML consumers.',
      },
      {
        company: 'MetricForge',
        title: 'Analytics Engineer',
        description: 'Modeled warehouse tables, added tests, and improved dashboard freshness for business stakeholders.',
      },
      {
        company: 'SignalLoop',
        title: 'Streaming Data Engineer',
        description: 'Designed Kafka consumers and Spark jobs for near-real-time product and revenue analytics.',
      },
    ],
    certifications: ['Databricks Data Engineer Associate', 'Astronomer Certification for Apache Airflow', 'AWS Certified Data Engineer'],
  },
  {
    key: 'ml',
    headline: 'Machine Learning Engineer',
    summaryTemplates: [
      'Machine learning engineer with production experience in NLP, recommendation systems, and model monitoring.',
      'Applied ML engineer who moves models from notebooks to production with strong MLOps and feature engineering practices.',
      'Engineer focused on Python, PyTorch, and data pipelines for high-impact ML systems serving customer-facing products.',
    ],
    skillPool: [
      { name: 'Python', area: 'Programming', baseYears: 5 },
      { name: 'PyTorch', area: 'Machine Learning', baseYears: 3 },
      { name: 'Feature Engineering', area: 'Machine Learning', baseYears: 3 },
      { name: 'MLOps', area: 'Machine Learning', baseYears: 2 },
      { name: 'Apache Spark', area: 'Data Engineering', baseYears: 2 },
      { name: 'Vector databases', area: 'Databases', baseYears: 2 },
      { name: 'MongoDB Atlas Vector Search', area: 'Databases', baseYears: 1 },
    ],
    experienceTemplates: [
      {
        company: 'Applied AI Studio',
        title: 'ML Engineer',
        description: 'Trained and deployed models, added offline evaluation, and collaborated with product teams on ranking systems.',
      },
      {
        company: 'Insight Engines',
        title: 'Machine Learning Engineer',
        description: 'Built feature pipelines, improved inference reliability, and monitored drift in production models.',
      },
      {
        company: 'Lattice Research',
        title: 'Data Scientist',
        description: 'Prototyped ML approaches and productionised the strongest candidates with engineering teams.',
      },
    ],
    certifications: ['TensorFlow Developer Certificate', 'AWS Certified Machine Learning Specialty', 'DeepLearning.AI MLOps Specialization'],
  },
  {
    key: 'frontend',
    headline: 'Frontend / Full-Stack Engineer',
    summaryTemplates: [
      'Frontend-focused engineer building responsive React applications with strong collaboration across design and backend teams.',
      'Full-stack developer with experience shipping React interfaces and JavaScript services for customer-facing products.',
      'UI engineer with a product mindset, focused on accessibility, component systems, and maintainable frontend architecture.',
    ],
    skillPool: [
      { name: 'React', area: 'Frontend', baseYears: 4 },
      { name: 'JavaScript', area: 'Programming', baseYears: 5 },
      { name: 'TypeScript', area: 'Programming', baseYears: 3 },
      { name: 'CSS', area: 'Frontend', baseYears: 4 },
      { name: 'Node.js', area: 'Backend', baseYears: 2 },
      { name: 'REST APIs', area: 'Frontend', baseYears: 3 },
      { name: 'Testing Library', area: 'Frontend', baseYears: 2 },
    ],
    experienceTemplates: [
      {
        company: 'BrightLayer',
        title: 'Frontend Engineer',
        description: 'Delivered React features, refined component APIs, and improved usability for complex workflows.',
      },
      {
        company: 'Cedar Labs',
        title: 'Full-Stack Engineer',
        description: 'Implemented dashboard experiences, backend integrations, and tests for high-traffic internal tools.',
      },
      {
        company: 'Northwind Digital',
        title: 'UI Engineer',
        description: 'Worked closely with design to create accessible, reusable components and improve performance budgets.',
      },
    ],
    certifications: ['Meta Front-End Developer Certificate', 'Certified Scrum Developer', 'Google UX Design Certificate'],
  },
  {
    key: 'devops',
    headline: 'DevOps / Cloud Platform Engineer',
    summaryTemplates: [
      'Platform engineer specialising in cloud infrastructure, CI/CD, observability, and production reliability.',
      'DevOps engineer with deep experience automating deployments, improving container platforms, and scaling services safely.',
      'Cloud operations engineer focused on Kubernetes, infrastructure as code, and developer enablement for product teams.',
    ],
    skillPool: [
      { name: 'AWS', area: 'Cloud', baseYears: 4 },
      { name: 'Docker', area: 'Infrastructure', baseYears: 4 },
      { name: 'Kubernetes', area: 'Infrastructure', baseYears: 3 },
      { name: 'Terraform', area: 'Infrastructure', baseYears: 3 },
      { name: 'CI/CD', area: 'Infrastructure', baseYears: 4 },
      { name: 'Linux', area: 'Infrastructure', baseYears: 5 },
      { name: 'MongoDB', area: 'Databases', baseYears: 2 },
    ],
    experienceTemplates: [
      {
        company: 'LaunchGrid',
        title: 'Platform Engineer',
        description: 'Managed Kubernetes platforms, streamlined deployments, and improved operational visibility across services.',
      },
      {
        company: 'OpsPilot',
        title: 'DevOps Engineer',
        description: 'Automated infrastructure provisioning, hardened delivery pipelines, and reduced incident response time.',
      },
      {
        company: 'SkyFoundry',
        title: 'Cloud Engineer',
        description: 'Supported containerised applications, codified infrastructure, and scaled shared platform capabilities.',
      },
    ],
    certifications: ['AWS Certified Solutions Architect', 'Certified Kubernetes Administrator', 'HashiCorp Terraform Associate'],
  },
];

function buildName(index) {
  return `${pickVariant(FIRST_NAMES, index)} ${pickVariant(LAST_NAMES, index, Math.floor(index / FIRST_NAMES.length))}`;
}

function buildEmail(name, archetypeKey, index) {
  const normalized = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '');
  return `${normalized}.${archetypeKey}${String(index + 1).padStart(3, '0')}@example.dev`;
}

function buildPhone(index) {
  const area = 200 + (index % 700);
  const exchange = 300 + ((index * 7) % 600);
  const line = 1000 + ((index * 37) % 9000);
  return `+1-${area}-${exchange}-${line}`;
}

function buildSkills(archetype, index) {
  const shuffled = createDeterministicShuffle(archetype.skillPool, index);
  const selected = shuffled.slice(0, 5 + (index % 2));
  const seniorityBoost = Math.floor(index / CANDIDATE_ARCHETYPES.length) % 3;

  return selected.map((skill, skillIndex) => ({
    name: skill.name,
    area: skill.area,
    years: skill.baseYears + seniorityBoost + (skillIndex % 2),
  }));
}

function buildExperience(archetype, index) {
  const templates = createDeterministicShuffle(archetype.experienceTemplates, index).slice(0, 2 + (index % 2));
  const currentYear = 2026;

  return templates.map((template, experienceIndex) => {
    const endYear = currentYear - ((templates.length - experienceIndex - 1) * 2);
    const startYear = endYear - (2 + ((index + experienceIndex) % 2));

    return {
      company: template.company,
      title: template.title,
      start: `${startYear}-01`,
      end: experienceIndex === templates.length - 1 ? 'Present' : `${endYear}-12`,
      description: template.description,
    };
  });
}

function buildEducation(archetype, index) {
  return [pickVariant(EDUCATION_POOL[archetype.key], index)];
}

function buildCertifications(archetype, index) {
  return createDeterministicShuffle(archetype.certifications, index).slice(0, 1 + (index % 2));
}

function buildSummary(archetype, index, skills) {
  const summary = pickVariant(archetype.summaryTemplates, index);
  const featuredSkills = skills.slice(0, 3).map((skill) => skill.name).join(', ');
  return `${summary} Core strengths include ${featuredSkills}. Targeting roles that value hands-on delivery, collaboration, and measurable engineering impact.`;
}

function buildCandidate(archetype, index) {
  const name = buildName(index);
  const skills = buildSkills(archetype, index);

  return {
    name,
    email: buildEmail(name, archetype.key, index),
    phone: buildPhone(index),
    location: pickVariant(CITIES, index, archetype.key.length),
    summary: buildSummary(archetype, index, skills),
    skills,
    experience: buildExperience(archetype, index),
    education: buildEducation(archetype, index),
    certifications: buildCertifications(archetype, index),
    source: 'manual',
  };
}

function generateCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const archetype = CANDIDATE_ARCHETYPES[index % CANDIDATE_ARCHETYPES.length];
    return buildCandidate(archetype, index);
  });
}

async function main() {
  const { apiUrl, count } = parseArgs(process.argv);
  const candidates = generateCandidates(count);

  await seedCollection({
    apiUrl,
    path: '/candidates',
    items: candidates,
    label: 'candidates',
    describeItem: (saved, candidate) => {
      const id = saved?.id ? `[${saved.id}] ` : '';
      return `${id}${candidate.name} <${candidate.email}>`;
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
  generateCandidates,
};
