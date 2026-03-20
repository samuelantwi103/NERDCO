// Single responsibility: all DB queries for vehicles and location_history
const pool = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

async function create({ organizationId, organizationType, vehicleType, licensePlate, driverUserId }) {
  const { rows } = await pool.query(
    `INSERT INTO vehicles (id, organization_id, organization_type, vehicle_type, license_plate, driver_user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [uuidv4(), organizationId, organizationType, vehicleType, licensePlate, driverUserId || null]
  );
  return rows[0];
}

async function findAll(filters: any = {}) {
  const { type, status, organizationId, driverUserId } = filters;
  const conditions: string[] = [];
  const params: any[] = [];
  if (type)           { params.push(type);           conditions.push(`vehicle_type = $${params.length}`); }
  if (status)         { params.push(status);         conditions.push(`status = $${params.length}`); }
  if (organizationId) { params.push(organizationId); conditions.push(`organization_id = $${params.length}`); }
  if (driverUserId)   { params.push(driverUserId);   conditions.push(`driver_user_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM vehicles ${where} ORDER BY created_at DESC`, params);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
  return rows[0] || null;
}

async function updateLocation({ id, latitude, longitude }) {
  const { rows } = await pool.query(
    `UPDATE vehicles SET latitude = $1, longitude = $2, last_updated = NOW() WHERE id = $3 RETURNING *`,
    [latitude, longitude, id]
  );
  return rows[0] || null;
}

// Conditional update — WHERE status = 'available' prevents race conditions on dispatch claims.
// incidentId: set when dispatching (links vehicle to its active incident); null to clear on release.
async function updateStatus({ id, newStatus, incidentId = null }: { id: string; newStatus: string; incidentId?: string | null }) {
  const whereClause = newStatus === 'dispatched' ? `WHERE id = $3 AND status = 'available'` : `WHERE id = $3`;
  // Clear incident link when vehicle becomes available again; set it on dispatch.
  const incidentValue = newStatus === 'available' ? null : incidentId;
  const { rows } = await pool.query(
    `UPDATE vehicles SET status = $1, current_incident_id = $2, last_updated = NOW() ${whereClause} RETURNING *`,
    [newStatus, incidentValue, id]
  );
  return rows[0] || null; // null means status condition failed (race condition on dispatch)
}

// Direct incident link update — used when incident resolves and vehicle was already
// set back to available by a separate status call.
async function setCurrentIncident(id: string, incidentId: string | null) {
  const { rows } = await pool.query(
    `UPDATE vehicles SET current_incident_id = $1, last_updated = NOW() WHERE id = $2 RETURNING *`,
    [incidentId, id]
  );
  return rows[0] || null;
}

async function saveLocationHistory({ vehicleId, latitude, longitude, recordedAt }) {
  await pool.query(
    'INSERT INTO location_history (id, vehicle_id, latitude, longitude, recorded_at) VALUES ($1, $2, $3, $4, $5)',
    [uuidv4(), vehicleId, latitude, longitude, recordedAt]
  );
}

module.exports = { create, findAll, findById, updateLocation, updateStatus, setCurrentIncident, saveLocationHistory };
