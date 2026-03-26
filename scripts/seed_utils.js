#!/usr/bin/env node

const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_COUNT = 200;

function parseArgs(argv) {
  const apiUrlIndex = argv.indexOf('--api-url');
  const countIndex = argv.indexOf('--count');

  const apiUrl = apiUrlIndex >= 0 ? argv[apiUrlIndex + 1] : DEFAULT_API_URL;
  const rawCount = countIndex >= 0 ? argv[countIndex + 1] : String(DEFAULT_COUNT);
  const count = Number.parseInt(rawCount, 10);

  if (!apiUrl) {
    throw new Error('Missing value for --api-url');
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Invalid --count value: ${rawCount}`);
  }

  return { apiUrl, count };
}

async function postJson(apiUrl, path, payload) {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function seedCollection({
  apiUrl,
  path,
  items,
  label,
  describeItem,
}) {
  console.log(`Seeding ${items.length} ${label} via ${apiUrl}${path}...\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    try {
      const saved = await postJson(apiUrl, path, item);
      successCount += 1;
      console.log(`✓ ${String(index + 1).padStart(3, ' ')} ${describeItem(saved, item)}`);
    } catch (err) {
      failureCount += 1;
      console.error(`✗ ${String(index + 1).padStart(3, ' ')} ${describeItem(null, item)} :: ${err.message}`);
    }
  }

  console.log('\nSummary:');
  console.log(`Requested: ${items.length}`);
  console.log(`Created:   ${successCount}`);
  console.log(`Failed:    ${failureCount}`);
}

function pickVariant(values, index, offset = 0) {
  return values[(index + offset) % values.length];
}

function createDeterministicShuffle(values, seed) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = (seed + i * 7) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

module.exports = {
  DEFAULT_API_URL,
  DEFAULT_COUNT,
  parseArgs,
  postJson,
  seedCollection,
  pickVariant,
  createDeterministicShuffle,
};
