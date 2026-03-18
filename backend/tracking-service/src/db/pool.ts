const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 10 });
pool.on('error', (err) => console.error('[tracking-db] client error', err.message));
module.exports = pool;
