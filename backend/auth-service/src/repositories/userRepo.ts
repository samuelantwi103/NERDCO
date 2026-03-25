// Single responsibility: all DB queries for the users table
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT u.*, o.type AS org_type
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE u.email = $1 AND u.is_active = true AND u.is_deleted = false`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
            o.id AS organization_id, o.name AS org_name, o.type AS org_type
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = $1 AND u.is_deleted = false`,
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

// List all users across all orgs — system_admin only
async function listAll({ includeDeleted = false }: { includeDeleted?: boolean } = {}) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.is_deleted, u.deleted_at, u.created_at,
            o.id AS organization_id, o.name AS org_name, o.type AS org_type
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     ${includeDeleted ? '' : 'WHERE u.is_deleted = false'}
     ORDER BY u.is_deleted ASC, u.created_at DESC`
  );
  return rows;
}

// List users scoped to one org — org_admin only
async function listByOrg(orgId: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
            o.id AS organization_id, o.name AS org_name, o.type AS org_type
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE u.organization_id = $1 AND u.is_deleted = false
     ORDER BY u.created_at DESC`,
    [orgId]
  );
  return rows;
}

async function update({ id, name, role, is_active, organizationId }: any) {
  const { rows } = await pool.query(
    `UPDATE users
     SET name = $1, role = $2, is_active = $3, organization_id = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING id, name, email, role, is_active, organization_id, updated_at`,
    [name, role, is_active, organizationId, id]
  );
  return rows[0];
}

async function remove(id: string) {
  await pool.query(
    'UPDATE users SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );
}

async function restore(id: string) {
  await pool.query(
    'UPDATE users SET is_deleted = false, deleted_at = NULL, updated_at = NOW() WHERE id = $1',
    [id]
  );
}

async function hardDelete(id: string) {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

module.exports = { findByEmail, findById, create, updatePassword, listAll, listByOrg, update, remove, restore, hardDelete };
