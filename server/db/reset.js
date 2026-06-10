#!/usr/bin/env node
/**
 * WaveLength DB reset + seed
 * ----------------------------
 * 1. Drops ALL tables (cascade)
 * 2. Recreates schema from schema.sql (fully consolidated)
 * 3. Runs the aggregation + summarise + cluster pipeline TWICE
 *
 * Usage:
 *   node server/db/reset.js
 *
 * Requires DATABASE_URL in environment (or .env in server/).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs   = require('fs');
const path = require('path');
const pool = require('./pool');
const { runAggregation }        = require('../services/newsAggregator');
const { summarizeUnsummarized } = require('../services/claudeSummarizer');
const { clusterRecentStories }  = require('../services/clusterStories');

async function dropAll(client) {
  console.log('🗑  Dropping all tables...');
  await client.query(`
    DROP TABLE IF EXISTS
      feedback,
      trending_topics,
      digests,
      source_ratings,
      code_redemptions,
      promo_codes,
      password_reset_tokens,
      interactions,
      summaries,
      stories,
      users
    CASCADE;
  `);
  console.log('   ✓ All tables dropped');
}

async function applySchema(client) {
  console.log('🏗  Applying schema.sql...');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(sql);
  console.log('   ✓ Schema applied');
}

async function runPipeline(label) {
  console.log(`\n🔄 Pipeline run: ${label}`);
  const stories = await runAggregation();
  console.log(`   ✓ Aggregated`);
  const summaries = await summarizeUnsummarized();
  console.log(`   ✓ Summarised`);
  await clusterRecentStories();
  console.log(`   ✓ Clustered`);
}

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set. Add it to server/.env or export it.');
    process.exit(1);
  }

  console.log(`\n⚠️  Resetting database at:\n   ${process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@')}\n`);

  const client = await pool.connect();
  try {
    await dropAll(client);
    await applySchema(client);
  } finally {
    client.release();
  }

  await runPipeline('first');
  await runPipeline('second');

  console.log('\n✅  Reset complete. Database is fresh with two rounds of stories.');
  process.exit(0);
})().catch((err) => {
  console.error('❌  Reset failed:', err.message);
  process.exit(1);
});
