// Orchestrates: validate → fetch vehicles → Haversine sort → claim → persist → publish → respond
import type { IncidentType, VehicleModel, VehicleType } from '@nerdco/domain-types';

const axios       = require('axios');
const { v4: uuidv4 } = require('uuid');
const incidentRepo = require('../repositories/incidentRepo');
const { RESPONDER_MAP } = require('../config/responder-map');
const { haversineKm } = require('../utils/haversine');
const { publish }    = require('../utils/publisher');
const VALID_TYPES   = Object.keys(RESPONDER_MAP);
const TRACKING_URL  = () => process.env.TRACKING_SERVICE_URL || 'http://localhost:3003';
const OVERRIDE_SECS = 30;

async function create(req, res) {
  const { citizen_name, incident_type, latitude, longitude, notes } = req.body;

  if (!citizen_name || !incident_type || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'validation', message: 'citizen_name, incident_type, latitude and longitude are required' });
  }
  if (!VALID_TYPES.includes(incident_type)) {
    return res.status(400).json({ error: 'validation', message: `incident_type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const id          = uuidv4();
  const vehicle_type = RESPONDER_MAP[incident_type];
  const authHeader   = req.headers.authorization;

  await incidentRepo.create({ id, citizenName: citizen_name, incidentType: incident_type, latitude, longitude, notes, createdBy: req.user.sub });
  publish('incident.created', { incident_id: id, citizen_name, incident_type, latitude, longitude, notes, created_by: req.user.sub, created_at: new Date().toISOString() });

  // Fetch available vehicles from tracking service
  let vehicles: VehicleModel[] = [];
  try {
    const { data } = await axios.get(`${TRACKING_URL()}/vehicles`, {
      params: { type: vehicle_type, status: 'available' },
      headers: { authorization: authHeader },
    });
    vehicles = data.vehicles || [];
  } catch {
    return res.status(503).json({ error: 'tracking_unavailable', message: 'Incident saved. Will auto-dispatch when tracking service is available.', incident_id: id });
  }

  // Rank by straight-line distance — filter vehicles with no known position
  const ranked = vehicles
    .filter(v => v.latitude != null && v.longitude != null)
    .map(v => ({ ...v, distance_km: haversineKm(latitude, longitude, v.latitude, v.longitude) }))
    .sort((a, b) => a.distance_km - b.distance_km);

  if (!ranked.length) {
    return res.status(503).json({ error: 'no_vehicles', message: 'No vehicles with known location. Incident saved.', incident_id: id });
  }

  // Try to claim nearest vehicle — retry on 409 (race condition)
  let assigned: (VehicleModel & { distance_km: number }) | null = null;
  for (const v of ranked) {
    try {
      await axios.put(`${TRACKING_URL()}/vehicles/${v.id}/status`, { status: 'dispatched' }, { headers: { authorization: authHeader } });
      assigned = v;
      break;
    } catch (err: any) {
      if (err.response?.status === 409) continue; // claimed by another request — try next
      break;
    }
  }

  if (!assigned) {
    return res.status(503).json({ error: 'no_vehicles', message: 'All matched vehicles just became unavailable. Incident saved.', incident_id: id });
  }

  await incidentRepo.assignUnit({ id, unitId: assigned.id, unitType: vehicle_type });
  await incidentRepo.logStatusChange({ incidentId: id, oldStatus: 'created', newStatus: 'dispatched', changedBy: req.user.sub });
  publish('incident.dispatched', { incident_id: id, incident_type, latitude, longitude, assigned_unit_id: assigned.id, assigned_unit_type: vehicle_type, distance_km: +assigned.distance_km.toFixed(2), dispatched_at: new Date().toISOString() });

  const incident = await incidentRepo.findById(id);
  res.status(201).json({
    incident,
    dispatch_override_window_secs: OVERRIDE_SECS,
    alternative_responders: ranked
      .filter(v => v.id !== assigned.id)
      .slice(0, 5)
      .map(v => ({ vehicle_id: v.id, vehicle_type: v.vehicle_type, license_plate: v.license_plate, distance_km: +v.distance_km.toFixed(2), latitude: v.latitude, longitude: v.longitude })),
  });
}

async function listOpen(req, res) {
  try {
    res.json({ incidents: await incidentRepo.findOpen() });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getOne(req, res) {
  try {
    const incident = await incidentRepo.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'not_found', message: 'Incident not found' });
    const status_log = await incidentRepo.getStatusLog(req.params.id);
    res.json({ incident, status_log });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function updateStatus(req, res) {
  const { status, notes } = req.body;
  const VALID = ['dispatched', 'in_progress', 'resolved'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: 'validation', message: `status must be one of: ${VALID.join(', ')}` });
  }
  try {
    const incident = await incidentRepo.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'not_found', message: 'Incident not found' });

    await incidentRepo.updateStatus({ id: req.params.id, newStatus: status });
    await incidentRepo.logStatusChange({ incidentId: req.params.id, oldStatus: incident.status, newStatus: status, changedBy: req.user.sub, notes });

    const eventKey = status === 'in_progress' ? 'incident.in_progress' : `incident.${status}`;
    publish(eventKey, { incident_id: req.params.id, changed_by: req.user.sub, [`${status}_at`]: new Date().toISOString() });

    res.json({ message: `Incident status updated to ${status}` });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function reassign(req, res) {
  const { vehicle_id } = req.body;
  if (!vehicle_id) return res.status(400).json({ error: 'validation', message: 'vehicle_id is required' });

  try {
    const incident = await incidentRepo.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'not_found', message: 'Incident not found' });

    const authHeader = req.headers.authorization;

    // Claim new vehicle
    try {
      await axios.put(`${TRACKING_URL()}/vehicles/${vehicle_id}/status`, { status: 'dispatched' }, { headers: { authorization: authHeader } });
    } catch (err: any) {
      if (err.response?.status === 409) return res.status(409).json({ error: 'conflict', message: 'Vehicle is no longer available' });
      return res.status(502).json({ error: 'tracking_unavailable', message: 'Could not contact tracking service' });
    }

    // Release previous vehicle (fire-and-forget)
    if (incident.assigned_unit_id) {
      axios.put(`${TRACKING_URL()}/vehicles/${incident.assigned_unit_id}/status`, { status: 'available' }, { headers: { authorization: authHeader } }).catch(() => {});
    }

    await incidentRepo.assignUnit({ id: req.params.id, unitId: vehicle_id, unitType: incident.assigned_unit_type });
    publish('incident.dispatched', { incident_id: req.params.id, assigned_unit_id: vehicle_id, dispatched_at: new Date().toISOString(), override: true });

    res.json({ message: 'Vehicle reassigned successfully' });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { create, listOpen, getOne, updateStatus, reassign };
