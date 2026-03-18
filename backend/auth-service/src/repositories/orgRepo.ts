// Single responsibility: all DB queries for the organizations table
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function findAll() {
  const { rows } = await pool.query(
    'SELECT id, name, type, latitude, longitude, address, phone FROM organizations ORDER BY name'
  );
  return rows;
}

async function create({ name, type, latitude, longitude, address, phone }) {
  const { rows } = await pool.query(
    `INSERT INTO organizations (id, name, type, latitude, longitude, address, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [uuidv4(), name, type, latitude, longitude, address || null, phone || null]
  );
  return rows[0];
}

module.exports = { findAll, create };
