// Single responsibility: all DB queries for incidents and incident_status_log
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function create({ id, citizenName, incidentType, latitude, longitude, notes, createdBy }) {
  await pool.query(
    `INSERT INTO incidents (id, citizen_name, incident_type, latitude, longitude, notes, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'created')`,
    [id, citizenName, incidentType, latitude, longitude, notes || null, createdBy]
  );
}

async function assignUnit({ id, unitId, unitType }) {
  await pool.query(
    `UPDATE incidents
     SET status = 'dispatched', assigned_unit_id = $1, assigned_unit_type = $2,
         dispatched_at = NOW(), updated_at = NOW()
     WHERE id = $3`,
    [unitId, unitType, id]
  );
}

async function updateStatus({ id, newStatus }) {
  await pool.query(
    'UPDATE incidents SET status = $1, updated_at = NOW() WHERE id = $2',
    [newStatus, id]
  );
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findOpen() {
  const { rows } = await pool.query(
    `SELECT * FROM incidents WHERE status != 'resolved' ORDER BY created_at DESC`
  );
  return rows;
}

async function findUnassigned(incidentType) {
  const { rows } = await pool.query(
    `SELECT * FROM incidents WHERE status = 'created' AND assigned_unit_id IS NULL
     AND incident_type = $1 ORDER BY created_at ASC LIMIT 1`,
    [incidentType]
  );
  return rows[0] || null;
}

async function logStatusChange({ incidentId, oldStatus, newStatus, changedBy, notes }) {
  await pool.query(
    `INSERT INTO incident_status_log (id, incident_id, old_status, new_status, changed_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uuidv4(), incidentId, oldStatus, newStatus, changedBy, notes || null]
  );
}

async function getStatusLog(incidentId) {
  const { rows } = await pool.query(
    'SELECT * FROM incident_status_log WHERE incident_id = $1 ORDER BY changed_at ASC',
    [incidentId]
  );
  return rows;
}

module.exports = { create, assignUnit, updateStatus, findById, findOpen, findUnassigned, logStatusChange, getStatusLog };
