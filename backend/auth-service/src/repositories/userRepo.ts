// Single responsibility: all DB queries for the users table
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT u.*, o.type AS org_type
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE u.email = $1 AND u.is_active = true`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
            o.id AS org_id, o.name AS org_name, o.type AS org_type
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function create({ name, email, passwordHash, role, organizationId }) {
  const { rows } = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, organization_id, created_at`,
    [uuidv4(), name, email, passwordHash, role, organizationId || null]
  );
  return rows[0];
}

async function updatePassword(userId: string, passwordHash: string) {
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}

module.exports = { findByEmail, findById, create, updatePassword };
