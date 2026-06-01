/**
 * Run all DB migrations in order.
 * Usage: node db/migrate.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./pool');
const fs = require('fs');
const path = require('path');

const migrations = [
  'schema.sql',
  'migration-all.sql',
  'migration-free-tier.sql',
  'migration-password-reset.sql',
];

(async () => {
  for (const file of migrations) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`Running ${file}...`);
    await pool.query(sql);
    console.log(`  ✓ ${file}`);
  }
  console.log('\nAll migrations complete.');
  await pool.end();
  process.exit(0);
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
