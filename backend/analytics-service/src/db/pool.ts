const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true')
    : undefined,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err: Error) => console.error('[analytics-db] client error', err.message));

const RETRYABLE = new Set(['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE']);
const _pgQuery = pool.query.bind(pool);

pool.query = async function retryQuery(...args: any[]): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= 4; attempt++) {
    try {
      return await _pgQuery(...args);
    } catch (err: any) {
      lastErr = err;
      const code: string = err.code ?? '';
      const msg: string = err.message ?? '';
      const retryable = RETRYABLE.has(code) || msg.includes('Connection terminated') || msg.includes('connection');
      if (!retryable || attempt === 4) throw err;
      const delay = Math.min(500 * 2 ** attempt, 8_000);
      console.warn(`[analytics-db] Retrying (${code || msg.slice(0, 40)}), attempt ${attempt + 1}/4 in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
};

module.exports = pool;
