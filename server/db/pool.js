const { Pool } = require('pg');

// rejectUnauthorized: true enforces real certificate validation in production.
// If your host uses self-signed certs, set DB_SSL_REJECT_UNAUTHORIZED=false explicitly.
const sslConfig = process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

module.exports = pool;
