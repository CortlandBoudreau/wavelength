const { Pool } = require('pg');

// Railway (and most managed Postgres hosts) use self-signed certs —
// rejectUnauthorized must be false or connections will fail with SSL errors.
// Local dev uses no SSL at all.
const sslConfig = process.env.DATABASE_URL?.includes('railway') ||
                  process.env.DATABASE_URL?.includes('rlwy.net') ||
                  process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

module.exports = pool;
