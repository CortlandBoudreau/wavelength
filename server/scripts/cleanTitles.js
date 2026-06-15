/**
 * Re-clean existing story titles with the same logic new stories get at
 * ingestion: strip social hashtags, markdown/HTML links, bare URLs, emoji,
 * and reply markers. Reuses cleanTitle + stripHashtags from the aggregator so
 * the result is identical to going-forward behavior.
 *
 * Usage:
 *   node server/scripts/cleanTitles.js            # DRY RUN — prints diffs, writes nothing
 *   node server/scripts/cleanTitles.js --commit   # apply the changes
 *
 * Requires DATABASE_URL in your environment (same as the server).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../db/pool');
const { cleanTitle, stripHashtags } = require('../services/newsAggregator');

const COMMIT = process.argv.includes('--commit');

async function main() {
  console.log(COMMIT
    ? '\n⚠️  COMMIT MODE — titles will be updated.\n'
    : '\n🔍 DRY RUN — nothing will be written. Add --commit to apply.\n');

  const { rows } = await pool.query(`SELECT id, title FROM stories WHERE deleted_at IS NULL`);

  const updates = [];
  for (const r of rows) {
    const cleaned = stripHashtags(cleanTitle(r.title));
    // Skip if cleaning emptied it or made no difference
    if (cleaned && cleaned !== r.title) updates.push({ id: r.id, before: r.title, after: cleaned });
  }

  console.log(`${updates.length} of ${rows.length} titles would change.\n`);
  for (const u of updates.slice(0, 200)) {
    console.log(`  - ${u.before.slice(0, 90)}`);
    console.log(`  + ${u.after.slice(0, 90)}\n`);
  }
  if (updates.length > 200) console.log(`  …and ${updates.length - 200} more.\n`);

  if (COMMIT) {
    for (const u of updates) {
      await pool.query(`UPDATE stories SET title = $1 WHERE id = $2`, [u.after, u.id]);
    }
    console.log(`✓ Updated ${updates.length} titles.\n`);
  } else {
    console.log('Dry run complete. Re-run with --commit to apply.\n');
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
