#!/usr/bin/env node
/**
 * reembed.js
 *
 * Re-generates the `embedding` vector for all documents in the `candidates`
 * and `jobs` collections by re-calling the Atlas VoyageAI REST API with the
 * stored `embedText` field.
 *
 * Use this when:
 *   - You upgrade the VoyageAI model (e.g. voyage-4-large → voyage-4-xl)
 *   - You update the embedText construction logic in EmbedderService
 *
 * Why this works:
 *   Because `embedText` is stored on every document alongside the `embedding`,
 *   re-embedding does NOT require re-running LLM extraction or touching the
 *   source PDFs. The stored string is sent directly to the new model.
 *
 * Prerequisites:
 *   - Set VOYAGE_API_KEY and VOYAGE_API_URL environment variables
 *   - Set MONGODB_URI environment variable
 *   - npm install mongodb  (or: node --experimental-vm-modules)
 *
 * Usage:
 *   VOYAGE_API_KEY=... MONGODB_URI=... node scripts/reembed.js
 *   node scripts/reembed.js --model voyage-4-xl --collection candidates
 *
 * Options:
 *   --collection   candidates | jobs | both (default: both)
 *   --model        VoyageAI model name (default: voyage-4-large)
 *   --dry-run      Print what would happen without writing to MongoDB
 */

import { MongoClient } from 'mongodb';

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_API_URL = process.env.VOYAGE_API_URL ?? 'https://ai.mongodb.com/v1/embeddings';
const MONGODB_URI    = process.env.MONGODB_URI;
const DATABASE_NAME  = process.env.MONGODB_DATABASE ?? 'jobmatching';

// ── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
}

const MODEL      = getArg('--model')      ?? 'voyage-4-large';
const COLLECTION = getArg('--collection') ?? 'both';
const DRY_RUN    = args.includes('--dry-run');

// ── Embedding helper ───────────────────────────────────────────────────────

async function embedText(text) {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: MODEL,
      input_type: 'document',
    }),
  });

  if (!res.ok) {
    throw new Error(`Atlas embedding API error: HTTP ${res.status} — ${await res.text()}`);
  }

  const json = await res.json();
  return json.data[0].embedding;
}

// ── Re-embed a collection ──────────────────────────────────────────────────

async function reembedCollection(db, collectionName) {
  const collection = db.collection(collectionName);

  // Only process documents that have an embedText field
  const cursor = collection.find({ embedText: { $exists: true, $ne: null } });
  let processed = 0;
  let errors = 0;

  console.log(`\n── ${collectionName} ─────────────────────────────────`);

  for await (const doc of cursor) {
    const label = doc.name ?? doc.title ?? doc._id.toString();
    try {
      const embedding = await embedText(doc.embedText);

      if (!DRY_RUN) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { embedding } }
        );
      }

      processed++;
      console.log(`  ✓ [${doc._id}] ${label} (${embedding.length} dims)`);

      // Polite rate limiting — the Atlas API has per-second limits
      await new Promise((r) => setTimeout(r, 100));

    } catch (err) {
      errors++;
      console.error(`  ✗ [${doc._id}] ${label}: ${err.message}`);
    }
  }

  console.log(`\n  ${collectionName}: ${processed} re-embedded, ${errors} errors`);
  if (DRY_RUN) console.log('  (dry run — no documents were updated)');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!VOYAGE_API_KEY) {
    console.error('Error: VOYAGE_API_KEY environment variable is not set.');
    process.exit(1);
  }
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  console.log(`Re-embedding with model: ${MODEL}`);
  console.log(`Collections: ${COLLECTION}`);
  if (DRY_RUN) console.log('Dry run mode — no writes will occur.\n');

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DATABASE_NAME);

  try {
    if (COLLECTION === 'candidates' || COLLECTION === 'both') {
      await reembedCollection(db, 'candidates');
    }
    if (COLLECTION === 'jobs' || COLLECTION === 'both') {
      await reembedCollection(db, 'jobs');
    }
  } finally {
    await client.close();
    console.log('\nDone.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
