// Single responsibility: all DB queries for incidents and incident_status_log
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function create({ id, citizenName, incidentType, severity = 'high', latitude, longitude, notes, createdBy, parentIncidentId = null }) {
  await pool.query(
    `INSERT INTO incidents (id, citizen_name, incident_type, severity, latitude, longitude, notes, created_by, parent_incident_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'created')`,
    [id, citizenName, incidentType, severity, latitude, longitude, notes || null, createdBy, parentIncidentId]
  );
}

async function assignUnit({ id, unitId, unitType, destinationHospitalId = null, destinationHospitalName = null }) {
  await pool.query(
    `UPDATE incidents
     SET status = 'dispatched', assigned_unit_id = $1, assigned_unit_type = $2,
         destination_hospital_id = $3, destination_hospital_name = $4,
         dispatched_at = NOW(), updated_at = NOW()
     WHERE id = $5`,
    [unitId, unitType, destinationHospitalId, destinationHospitalName, id]
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

async function findOpen({ limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}) {
  const safeLimit  = Math.min(Math.max(1, Number(limit)  || 100), 500);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const { rows } = await pool.query(
    `SELECT * FROM incidents WHERE status != 'resolved' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );
  return rows;
}

// Returns open incidents of the same type within a rough bounding box.
// The caller applies haversine filtering for the exact radius.
// Box side ≈ 0.004° ≈ 450m — wide enough to catch 200m radius without extra API calls.
async function findNearbyOpen(incidentType: string, lat: number, lng: number) {
  const delta = 0.004; // ~450m bounding box half-side
  const { rows } = await pool.query(
    `SELECT * FROM incidents
     WHERE incident_type = $1
       AND status != 'resolved'
       AND latitude  BETWEEN $2 AND $3
       AND longitude BETWEEN $4 AND $5
     ORDER BY created_at DESC`,
    [incidentType, lat - delta, lat + delta, lng - delta, lng + delta]
  );
  return rows;
}

async function findUnassigned(incidentType: string | null) {
  if (incidentType) {
    // Scoped query used by the dispatch retry background job for a specific type
    const { rows } = await pool.query(
      `SELECT * FROM incidents WHERE status = 'created' AND assigned_unit_id IS NULL
       AND incident_type = $1 ORDER BY created_at ASC LIMIT 1`,
      [incidentType]
    );
    return rows[0] || null;
  }
  // Fetch all unassigned incidents across all types (used by retry job)
  const { rows } = await pool.query(
    `SELECT * FROM incidents WHERE status = 'created' AND assigned_unit_id IS NULL
     ORDER BY created_at ASC LIMIT 50`
  );
  return rows;
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

// Returns all child incidents linked to a parent (created via request-support)
async function findRelated(parentId: string) {
  const { rows } = await pool.query(
    `SELECT * FROM incidents WHERE parent_incident_id = $1 ORDER BY created_at ASC`,
    [parentId]
  );
  return rows;
}

module.exports = { create, assignUnit, updateStatus, findById, findOpen, findNearbyOpen, findUnassigned, logStatusChange, getStatusLog, findRelated };
