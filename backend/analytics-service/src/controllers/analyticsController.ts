const repo = require('../repositories/analyticsRepo');

async function getSummary(req, res) {
  try { res.status(200).json(await repo.getSummary()); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getResponseTimes(req, res) {
  try { res.status(200).json(await repo.getResponseTimes(req.query)); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getIncidentsByRegion(req, res) {
  try { res.status(200).json({ regions: await repo.getIncidentsByRegion(req.query) }); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getResourceUtilization(req, res) {
  try { res.status(200).json({ utilization: await repo.getResourceUtilization({ organizationId: req.query.organization_id, vehicleType: req.query.vehicle_type }) }); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getBedUtilization(req, res) {
  try { res.status(200).json({ hospitals: await repo.getBedUtilization() }); }
  catch { res.status(500).json({ error: 'server_error', message: 'Internal server error' }); }
}

async function getMostDeployed(req, res) {
  try {
    res.status(200).json({ responders: await repo.getMostDeployed({ vehicleType: req.query.vehicle_type, from: req.query.from, to: req.query.to, limit: req.query.limit }) });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { getSummary, getResponseTimes, getIncidentsByRegion, getResourceUtilization, getBedUtilization, getMostDeployed };
