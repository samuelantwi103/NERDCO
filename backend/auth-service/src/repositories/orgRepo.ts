// Single responsibility: all DB queries for the organizations table
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function findAll() {
  const { rows } = await pool.query(
    `SELECT id, name, type, latitude, longitude, address, phone,
            beds_available, beds_total, capabilities
     FROM organizations ORDER BY name`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, type, latitude, longitude, address, phone,
            beds_available, beds_total, capabilities
     FROM organizations WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Returns hospitals that currently have at least one bed available, ordered by name.
// incident-service queries this to pick a destination hospital for medical incidents.
async function findHospitalsWithCapacity() {
  const { rows } = await pool.query(
    `SELECT id, name, latitude, longitude, beds_available, beds_total, capabilities
     FROM organizations
     WHERE type = 'hospital' AND beds_available > 0
     ORDER BY name`
  );
  return rows;
}

async function create({ name, type, latitude, longitude, address, phone, bedsAvailable = 0, bedsTotal = 0, capabilities = [] }: any) {
  const { rows } = await pool.query(
    `INSERT INTO organizations (id, name, type, latitude, longitude, address, phone, beds_available, beds_total, capabilities)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [uuidv4(), name, type, latitude, longitude, address || null, phone || null, bedsAvailable, bedsTotal, capabilities]
  );
  return rows[0];
}

// Shift beds_available by +/- delta. Uses GREATEST(0) so count never goes negative.
// Called by incident-service via service secret on dispatch (-1) and resolve (+1).
async function shiftBeds(id: string, delta: number) {
  const { rows } = await pool.query(
    `UPDATE organizations
     SET beds_available = GREATEST(0, beds_available + $1), updated_at = NOW()
     WHERE id = $2 AND type = 'hospital'
     RETURNING id, name, beds_available, beds_total`,
    [delta, id]
  );
  return rows[0] || null;
}

// Absolute capacity update — called by hospital admin via PATCH /organizations/:id/capacity.
async function setCapacity(id: string, bedsAvailable: number, bedsTotal?: number) {
  const { rows } = await pool.query(
    `UPDATE organizations
     SET beds_available = $1, beds_total = COALESCE($2, beds_total), updated_at = NOW()
     WHERE id = $3 AND type = 'hospital'
     RETURNING id, name, beds_available, beds_total`,
    [bedsAvailable, bedsTotal ?? null, id]
  );
  return rows[0] || null;
}

module.exports = { findAll, findById, findHospitalsWithCapacity, create, shiftBeds, setCapacity };
