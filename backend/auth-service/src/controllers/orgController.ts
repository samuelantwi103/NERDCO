const orgRepo = require('../repositories/orgRepo');
const { publish } = require('../utils/publisher');

const VALID_TYPES = ['hospital', 'ambulance_service', 'police_station', 'fire_station'];

async function list(req, res) {
  try {
    res.status(200).json({ organizations: await orgRepo.findAll() });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function create(req, res) {
  const { name, type, latitude, longitude, address, phone, beds_available, beds_total } = req.body;
  if (!name || !type || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'validation', message: 'name, type, latitude and longitude are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'validation', message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  try {
    res.status(201).json({
      organization: await orgRepo.create({ name, type, latitude, longitude, address, phone, bedsAvailable: beds_available ?? 0, bedsTotal: beds_total ?? 0 }),
    });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// GET /organizations/hospitals/available — internal (service secret) or system_admin
// Returns hospitals with beds_available > 0, used by incident-service to pick destination.
async function listHospitalsWithCapacity(req, res) {
  try {
    res.status(200).json({ hospitals: await orgRepo.findHospitalsWithCapacity() });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// PATCH /organizations/:id/capacity
// Two callers, two distinct code paths:
//   - JWT (org_admin/system_admin): sets absolute beds_available + optional beds_total
//   - Service secret (incident-service): shifts beds_available by delta (+1 / -1)
async function updateCapacity(req, res) {
  try {
    const isJwtCall = !!req.user; // verifyJwtOrSecret sets req.user only for JWT path
    let org;

    if (isJwtCall) {
      if (req.user.role === 'org_admin' && req.user.org !== req.params.id) {
        return res.status(403).json({ error: 'forbidden', message: 'You can only update capacity for your own organisation' });
      }
      const { beds_available, beds_total } = req.body;
      if (beds_available == null) {
        return res.status(400).json({ error: 'validation', message: 'beds_available is required' });
      }
      org = await orgRepo.setCapacity(req.params.id, beds_available, beds_total);
    } else {
      const { delta } = req.body;
      if (delta == null || typeof delta !== 'number') {
        return res.status(400).json({ error: 'validation', message: 'delta (number) is required for service-to-service capacity adjustments' });
      }
      org = await orgRepo.shiftBeds(req.params.id, delta);
    }

    if (!org) {
      return res.status(404).json({ error: 'not_found', message: 'Hospital not found or organisation is not a hospital' });
    }

    publish('hospital.capacity_updated', {
      hospital_id:    org.id,
      hospital_name:  org.name,
      beds_available: org.beds_available,
      beds_total:     org.beds_total,
      updated_at:     new Date().toISOString(),
    });

    res.status(200).json({ organization: org });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { list, create, listHospitalsWithCapacity, updateCapacity };
