// Single responsibility: all DB queries for the refresh_tokens table
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function save(userId, tokenHash, expiresAt) {
  await pool.query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [uuidv4(), userId, tokenHash, expiresAt]
  );
}

async function findValid(tokenHash) {
  const { rows } = await pool.query(
    `SELECT rt.user_id, u.role, u.organization_id
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revoke(tokenHash, userId) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1 AND user_id = $2',
    [tokenHash, userId]
  );
}

module.exports = { save, findValid, revoke };
