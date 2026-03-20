// Single responsibility: all DB queries for the password_reset_tokens table
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

async function save(userId: string, tokenHash: string) {
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await pool.query(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [uuidv4(), userId, tokenHash, expiresAt]
  );
}

async function findValid(tokenHash: string) {
  const { rows } = await pool.query(
    `SELECT prt.id, prt.user_id, u.email, u.name
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1 AND prt.used = false AND prt.expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function markUsed(tokenHash: string) {
  await pool.query(
    'UPDATE password_reset_tokens SET used = true WHERE token_hash = $1',
    [tokenHash]
  );
}

module.exports = { save, findValid, markUsed };
