const repo = require('../repositories/analyticsRepo');

async function getSummary(req, res) {
  try { res.json(await repo.getSummary()); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getResponseTimes(req, res) {
  try { res.json(await repo.getResponseTimes(req.query)); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getIncidentsByRegion(req, res) {
  try { res.json({ regions: await repo.getIncidentsByRegion(req.query) }); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getResourceUtilization(req, res) {
  try { res.json({ utilization: await repo.getResourceUtilization({ organizationId: req.query.organization_id, vehicleType: req.query.vehicle_type }) }); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

module.exports = { getSummary, getResponseTimes, getIncidentsByRegion, getResourceUtilization };
