require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_category_check;
  ALTER TABLE stories ADD CONSTRAINT stories_category_check
    CHECK (category IN ('marine_science','diversity_stem','science','cool_facts','space','climate','wildlife','health_science'));
  ALTER TABLE users ALTER COLUMN interests
    SET DEFAULT '{"marine_science","diversity_stem","science","cool_facts","space","climate","wildlife","health_science"}';
`)
.then(() => { console.log('Categories updated!'); process.exit(0); })
.catch(e => { console.error('Failed:', e.message); process.exit(1); });
