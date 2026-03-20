// Single responsibility: all DB queries for analytics reads and snapshot writes
const pool = require('../db/pool');

// ── Read queries (used by controllers) ───────────────────────────────────────

async function getSummary() {
  const [open, today, avgRes, vehicles] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM incident_snapshots WHERE status != 'resolved'`),
    pool.query(`SELECT COUNT(*) FROM incident_snapshots WHERE created_at >= CURRENT_DATE`),
    pool.query(`SELECT AVG(response_time_secs)::int AS avg FROM incident_snapshots WHERE dispatched_at IS NOT NULL AND created_at >= CURRENT_DATE`),
    pool.query(`SELECT status, COUNT(*) AS count FROM vehicle_snapshots GROUP BY status`),
  ]);
  const v: any = {};
  for (const row of vehicles.rows) v[row.status] = +row.count;
  return {
    open_incidents:               +open.rows[0].count,
    incidents_today:              +today.rows[0].count,
    avg_response_time_secs_today: avgRes.rows[0].avg || 0,
    vehicles_available:           v.available   || 0,
    vehicles_dispatched:          v.dispatched  || 0,
    vehicles_unavailable:         v.unavailable || 0,
  };
}

async function getResponseTimes(filters: any = {}) {
  const { type, from, to } = filters;
  const conditions = ['dispatched_at IS NOT NULL'];
  const params: any[] = [];
  if (type) { params.push(type); conditions.push(`incident_type = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`); }
  if (to)   { params.push(to);   conditions.push(`created_at <= $${params.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const [overall, byType] = await Promise.all([
    pool.query(`SELECT AVG(response_time_secs)::int AS avg, MIN(response_time_secs) AS min, MAX(response_time_secs) AS max, COUNT(*) AS total FROM incident_snapshots ${where}`, params),
    pool.query(`SELECT incident_type, AVG(response_time_secs)::int AS avg_secs, MIN(response_time_secs) AS min_secs, MAX(response_time_secs) AS max_secs, COUNT(*) AS count FROM incident_snapshots ${where} GROUP BY incident_type`, params),
  ]);
  const byTypeMap: any = {};
  for (const row of byType.rows) byTypeMap[row.incident_type] = { avg_secs: row.avg_secs, min_secs: +row.min_secs, max_secs: +row.max_secs, count: +row.count };
  const o = overall.rows[0];
  return { overall_avg_secs: o.avg || 0, overall_min_secs: +o.min || 0, overall_max_secs: +o.max || 0, total_incidents: +o.total, by_type: byTypeMap };
}

async function getIncidentsByRegion(filters: any = {}) {
  const { type, from, to, limit = 100 } = filters;
  const conditions: string[] = [];
  const params: any[] = [];
  if (type) { params.push(type); conditions.push(`incident_type = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`created_at >= $${params.length}`); }
  if (to)   { params.push(to);   conditions.push(`created_at <= $${params.length}`); }
  params.push(+limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT ROUND(latitude::numeric,1) AS lat_grid, ROUND(longitude::numeric,1) AS lng_grid, incident_type, COUNT(*) AS count
     FROM incident_snapshots ${where} GROUP BY lat_grid, lng_grid, incident_type ORDER BY count DESC LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function getResourceUtilization(filters: any = {}) {
  const { organizationId, vehicleType } = filters;
  const conditions: string[] = [];
  const params: any[] = [];
  if (organizationId) { params.push(organizationId); conditions.push(`organization_id = $${params.length}`); }
  if (vehicleType)    { params.push(vehicleType);    conditions.push(`vehicle_type = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT organization_id, vehicle_type, status, COUNT(*) AS count FROM vehicle_snapshots ${where} GROUP BY organization_id, vehicle_type, status ORDER BY organization_id, vehicle_type`,
    params
  );
  return rows;
}

// ── Write queries (used by event consumer) ───────────────────────────────────

async function isDuplicate(eventId) {
  const { rows } = await pool.query('SELECT id FROM event_log WHERE id = $1', [eventId]);
  return rows.length > 0;
}

async function logEvent(eventId, routingKey, payload, processed) {
  await pool.query(
    'INSERT INTO event_log (id, routing_key, payload, received_at, processed) VALUES ($1, $2, $3, NOW(), $4) ON CONFLICT DO NOTHING',
    [eventId, routingKey, JSON.stringify(payload), processed]
  );
}

async function upsertIncidentSnapshot(data) {
  await pool.query(
    `INSERT INTO incident_snapshots (id, incident_type, latitude, longitude, status, created_at)
     VALUES ($1, $2, $3, $4, 'created', $5) ON CONFLICT (id) DO NOTHING`,
    [data.incident_id, data.incident_type, data.latitude, data.longitude, data.created_at]
  );
}

async function updateSnapshotDispatched(incidentId, dispatchedAt) {
  await pool.query(
    `UPDATE incident_snapshots SET status = 'dispatched', dispatched_at = $2,
     response_time_secs = EXTRACT(EPOCH FROM ($2::timestamptz - created_at))::int WHERE id = $1`,
    [incidentId, dispatchedAt]
  );
}

async function updateSnapshotInProgress(incidentId, inProgressAt) {
  await pool.query(
    `UPDATE incident_snapshots SET status = 'in_progress', in_progress_at = $2 WHERE id = $1`,
    [incidentId, inProgressAt]
  );
}

async function updateSnapshotResolved(incidentId, resolvedAt) {
  await pool.query(
    `UPDATE incident_snapshots SET status = 'resolved', resolved_at = $2,
     resolution_time_secs = EXTRACT(EPOCH FROM ($2::timestamptz - created_at))::int WHERE id = $1`,
    [incidentId, resolvedAt]
  );
}

async function upsertHospitalCapacity(data) {
  await pool.query(
    `INSERT INTO hospital_capacity_snapshots (id, name, beds_available, beds_total, last_updated)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       name           = $2,
       beds_available = $3,
       beds_total     = $4,
       last_updated   = $5`,
    [data.hospital_id, data.hospital_name, data.beds_available, data.beds_total, data.updated_at]
  );
}

async function getBedUtilization() {
  const { rows } = await pool.query('SELECT * FROM v_bed_utilization');
  return rows;
}

// Returns vehicles ranked by number of times dispatched, grouped by vehicle type / emergency service.
// Satisfies spec requirement: "Most deployed responders per emergency service."
async function getMostDeployed(filters: any = {}) {
  const { vehicleType, from, to, limit = 20 } = filters;
  const conditions = ['assigned_unit_id IS NOT NULL'];
  const params: any[] = [];
  if (vehicleType) { params.push(vehicleType); conditions.push(`assigned_unit_type = $${params.length}`); }
  if (from)        { params.push(from);        conditions.push(`created_at >= $${params.length}`); }
  if (to)          { params.push(to);           conditions.push(`created_at <= $${params.length}`); }
  params.push(+limit);
  const where = `WHERE ${conditions.join(' AND ')}`;
  const { rows } = await pool.query(
    `SELECT assigned_unit_id AS vehicle_id, assigned_unit_type AS vehicle_type,
            COUNT(*) AS dispatch_count,
            AVG(response_time_secs)::int AS avg_response_secs
     FROM incident_snapshots ${where}
     GROUP BY assigned_unit_id, assigned_unit_type
     ORDER BY dispatch_count DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function upsertVehicleSnapshot(data) {
  await pool.query(
    `INSERT INTO vehicle_snapshots (id, organization_id, vehicle_type, status, latitude, longitude, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET status = $4, latitude = COALESCE($5, vehicle_snapshots.latitude),
       longitude = COALESCE($6, vehicle_snapshots.longitude), organization_id = COALESCE($2, vehicle_snapshots.organization_id), last_updated = $7`,
    [data.vehicle_id, data.organization_id || null, data.vehicle_type, data.status || data.new_status, data.latitude || null, data.longitude || null, data.recorded_at || data.changed_at]
  );
}

module.exports = { getSummary, getResponseTimes, getIncidentsByRegion, getResourceUtilization, getBedUtilization, getMostDeployed, isDuplicate, logEvent, upsertIncidentSnapshot, updateSnapshotDispatched, updateSnapshotInProgress, updateSnapshotResolved, upsertVehicleSnapshot, upsertHospitalCapacity };
