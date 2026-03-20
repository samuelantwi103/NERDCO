// Orchestrates: validate → fetch vehicles → Haversine sort → claim → persist → publish → respond
import type { VehicleModel } from '@nerdco/domain-types';
import {
  getAvailableVehicles,
  getVehicleById,
  getVehiclesByDriver,
  dispatchVehicle,
  releaseVehicle,
} from '../utils/trackingClient';
import { getHospitalsWithCapacity, adjustHospitalCapacity, type HospitalInfo } from '../utils/authClient';
import { withAudit } from '../utils/audit';

const { v4: uuidv4 } = require('uuid');
const incidentRepo = require('../repositories/incidentRepo');
const { RESPONDER_MAP, ORG_TYPE_INCIDENT_MAP } = require('../config/responder-map');
const { haversineKm } = require('../utils/haversine');
const { publish }    = require('../utils/publisher');

const VALID_TYPES    = Object.keys(RESPONDER_MAP);
const VALID_SEVERITY = ['low', 'medium', 'high', 'critical'];
const OVERRIDE_SECS  = 30;

// ── helpers ────────────────────────────────────────────────────────────────

function getAllowedIncidentTypes(user: any): string[] | null {
  if (user.role === 'system_admin') return null; // no filter — see everything
  if (user.role === 'org_admin' && user.org_type) {
    return ORG_TYPE_INCIDENT_MAP[user.org_type] || [];
  }
  return null;
}

async function rankAvailableVehicles(
  vehicleType: string,
  lat: number,
  lng: number,
  authHeader: string,
): Promise<(VehicleModel & { distance_km: number })[]> {
  const vehicles = await getAvailableVehicles(vehicleType, authHeader);
  return vehicles
    .filter(v => v.latitude != null && v.longitude != null)
    .map(v => ({ ...v, distance_km: haversineKm(lat, lng, v.latitude, v.longitude) }))
    .sort((a, b) => a.distance_km - b.distance_km);
}

async function claimNearestVehicle(
  ranked: (VehicleModel & { distance_km: number })[],
  authHeader: string,
  incidentId: string,
): Promise<(VehicleModel & { distance_km: number }) | null> {
  for (const v of ranked) {
    try {
      await dispatchVehicle(v.id, authHeader, incidentId);
      return v;
    } catch (err: any) {
      if (err.response?.status === 409) continue; // race — try next
      break;
    }
  }
  return null;
}

// ── handlers ───────────────────────────────────────────────────────────────

// For medical incidents: pick nearest hospital that has beds available.
// Returns null if auth-service unreachable or no hospital has capacity — dispatch still proceeds
// (driver is notified to confirm destination on arrival).
async function selectDestinationHospital(
  lat: number,
  lng: number,
): Promise<HospitalInfo | null> {
  let hospitals: HospitalInfo[];
  try {
    hospitals = await getHospitalsWithCapacity();
  } catch {
    return null; // non-fatal — don't block dispatch
  }
  if (!hospitals.length) return null;
  return hospitals
    .map(h => ({ ...h, distance_km: haversineKm(lat, lng, h.latitude, h.longitude) }))
    .sort((a, b) => a.distance_km - b.distance_km)[0];
}

async function create(req, res) {
  const { citizen_name, incident_type, severity = 'high', latitude, longitude, notes } = req.body;

  if (!citizen_name || !incident_type || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'validation', message: 'citizen_name, incident_type, latitude and longitude are required' });
  }
  if (!VALID_TYPES.includes(incident_type)) {
    return res.status(400).json({ error: 'validation', message: `incident_type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  if (!VALID_SEVERITY.includes(severity)) {
    return res.status(400).json({ error: 'validation', message: `severity must be one of: ${VALID_SEVERITY.join(', ')}` });
  }

  // Duplicate detection: if there is already an open incident of the same type
  // within 200m, return it instead of creating a second one.
  const DUPLICATE_RADIUS_KM = 0.2;
  const nearby = await incidentRepo.findNearbyOpen(incident_type, latitude, longitude);
  const duplicate = nearby.find(
    (i: any) => haversineKm(latitude, longitude, i.latitude, i.longitude) <= DUPLICATE_RADIUS_KM
  );
  if (duplicate) {
    return res.status(409).json({
      error:   'duplicate_incident',
      message: `An open ${incident_type} incident already exists within 200m of this location.`,
      existing_incident: duplicate,
    });
  }

  const id           = uuidv4();
  const vehicle_type = RESPONDER_MAP[incident_type];
  const authHeader   = req.headers.authorization;
  const isMedical    = incident_type === 'medical';

  await incidentRepo.create({ id, citizenName: citizen_name, incidentType: incident_type, severity, latitude, longitude, notes, createdBy: req.user.sub });
  publish('incident.created', { incident_id: id, citizen_name, incident_type, severity, latitude, longitude, notes, created_by: req.user.sub, created_at: new Date().toISOString() });

  // For medical incidents, find destination hospital in parallel with vehicle ranking
  const [ranked, destHospital] = await Promise.all([
    rankAvailableVehicles(vehicle_type, latitude, longitude, authHeader).catch(() => null),
    isMedical ? selectDestinationHospital(latitude, longitude) : Promise.resolve(null),
  ]);

  if (!ranked) {
    return res.status(503).json({ error: 'tracking_unavailable', message: 'Incident saved. Will auto-dispatch when tracking service is available.', incident_id: id });
  }
  if (!ranked.length) {
    return res.status(503).json({ error: 'no_vehicles', message: 'No vehicles with known location. Incident saved.', incident_id: id });
  }

  const assigned = await claimNearestVehicle(ranked, authHeader, id);
  if (!assigned) {
    return res.status(503).json({ error: 'no_vehicles', message: 'All matched vehicles just became unavailable. Incident saved.', incident_id: id });
  }

  await incidentRepo.assignUnit({
    id,
    unitId: assigned.id,
    unitType: vehicle_type,
    destinationHospitalId:   destHospital?.id   || null,
    destinationHospitalName: destHospital?.name || null,
  });
  await incidentRepo.logStatusChange({ incidentId: id, oldStatus: 'created', newStatus: 'dispatched', changedBy: req.user.sub, notes: withAudit(req) });

  // Optimistically decrement bed count — fire-and-forget, never block dispatch
  if (destHospital) {
    adjustHospitalCapacity(destHospital.id, -1).catch(() => {});
  }

  publish('incident.dispatched', { incident_id: id, incident_type, latitude, longitude, assigned_unit_id: assigned.id, assigned_unit_type: vehicle_type, distance_km: +assigned.distance_km.toFixed(2), dispatched_at: new Date().toISOString() });

  const incident = await incidentRepo.findById(id);
  res.status(201).json({
    incident,
    dispatch_override_window_secs: OVERRIDE_SECS,
    ...(destHospital && {
      destination_hospital: {
        id:             destHospital.id,
        name:           destHospital.name,
        beds_available: destHospital.beds_available,
      },
    }),
    alternative_responders: ranked
      .filter(v => v.id !== assigned.id)
      .slice(0, 5)
      .map(v => ({ vehicle_id: v.id, vehicle_type: v.vehicle_type, license_plate: v.license_plate, distance_km: +v.distance_km.toFixed(2), latitude: v.latitude, longitude: v.longitude })),
  });
}

async function listOpen(req, res) {
  try {
    const incidents = await incidentRepo.findOpen();

    if (req.user.role === 'first_responder') {
      let responderVehicleIds: Set<string>;
      try {
        responderVehicleIds = await getVehiclesByDriver(req.user.sub, req.headers.authorization);
      } catch {
        return res.status(502).json({ error: 'tracking_unavailable', message: 'Could not resolve responder vehicle assignments' });
      }
      return res.status(200).json({ incidents: incidents.filter(i => i.assigned_unit_id && responderVehicleIds.has(i.assigned_unit_id)) });
    }

    const allowedTypes = getAllowedIncidentTypes(req.user);
    if (allowedTypes !== null) {
      return res.status(200).json({ incidents: incidents.filter(i => allowedTypes.includes(i.incident_type)) });
    }

    res.status(200).json({ incidents });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getOne(req, res) {
  try {
    const incident = await incidentRepo.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'not_found', message: 'Incident not found' });

    if (req.user.role === 'first_responder') {
      if (!incident.assigned_unit_id) {
        return res.status(403).json({ error: 'forbidden', message: 'Incident is not assigned to your vehicle' });
      }
      let responderVehicleIds: Set<string>;
      try {
        responderVehicleIds = await getVehiclesByDriver(req.user.sub, req.headers.authorization);
      } catch {
        return res.status(502).json({ error: 'tracking_unavailable', message: 'Could not resolve responder vehicle assignments' });
      }
      if (!responderVehicleIds.has(incident.assigned_unit_id)) {
        return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions for this incident' });
      }
    }

    const allowedTypes = getAllowedIncidentTypes(req.user);
    if (allowedTypes !== null && !allowedTypes.includes(incident.incident_type)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions for this incident' });
    }

    const status_log = await incidentRepo.getStatusLog(req.params.id);
    res.status(200).json({ incident, status_log });
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

    if (req.user.role === 'first_responder') {
      if (status === 'dispatched') {
        return res.status(403).json({ error: 'forbidden', message: 'First responders cannot set dispatched status' });
      }
      if (!incident.assigned_unit_id) {
        return res.status(403).json({ error: 'forbidden', message: 'Incident is not assigned to a responder unit' });
      }

      let assignedVehicle: any = null;
      try {
        assignedVehicle = await getVehicleById(incident.assigned_unit_id, req.headers.authorization);
      } catch {
        return res.status(502).json({ error: 'tracking_unavailable', message: 'Could not validate responder assignment' });
      }

      if (!assignedVehicle || assignedVehicle.driver_user_id !== req.user.sub) {
        return res.status(403).json({ error: 'forbidden', message: 'You can only update incidents assigned to your vehicle' });
      }
      if (status === 'in_progress' && incident.status !== 'dispatched') {
        return res.status(409).json({ error: 'invalid_transition', message: 'First responder can start only dispatched incidents' });
      }
      if (status === 'resolved' && incident.status !== 'in_progress') {
        return res.status(409).json({ error: 'invalid_transition', message: 'First responder can resolve only in-progress incidents' });
      }
    }

    await incidentRepo.updateStatus({ id: req.params.id, newStatus: status });
    await incidentRepo.logStatusChange({ incidentId: req.params.id, oldStatus: incident.status, newStatus: status, changedBy: req.user.sub, notes: withAudit(req, notes) });

    // Release the bed reservation when incident resolves
    if (status === 'resolved' && incident.destination_hospital_id) {
      adjustHospitalCapacity(incident.destination_hospital_id, +1).catch(() => {});
    }

    const eventKey = status === 'in_progress' ? 'incident.in_progress' : `incident.${status}`;
    publish(eventKey, { incident_id: req.params.id, changed_by: req.user.sub, [`${status}_at`]: new Date().toISOString() });

    res.status(200).json({ message: `Incident status updated to ${status}` });
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

    try {
      await dispatchVehicle(vehicle_id, authHeader, req.params.id);
    } catch (err: any) {
      if (err.response?.status === 409) return res.status(409).json({ error: 'conflict', message: 'Vehicle is no longer available' });
      return res.status(502).json({ error: 'tracking_unavailable', message: 'Could not contact tracking service' });
    }

    // Release previous vehicle (fire-and-forget)
    if (incident.assigned_unit_id) {
      releaseVehicle(incident.assigned_unit_id, authHeader).catch(() => {});
    }

    await incidentRepo.assignUnit({ id: req.params.id, unitId: vehicle_id, unitType: incident.assigned_unit_type });
    await incidentRepo.logStatusChange({ incidentId: req.params.id, oldStatus: incident.status, newStatus: 'dispatched', changedBy: req.user.sub, notes: withAudit(req, 'manual override') });
    publish('incident.dispatched', { incident_id: req.params.id, assigned_unit_id: vehicle_id, dispatched_at: new Date().toISOString(), override: true });

    res.status(200).json({ message: 'Vehicle reassigned successfully' });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function requestSupport(req, res) {
  const { support_type } = req.body;
  const VALID_SUPPORT = ['ambulance', 'police_car', 'fire_truck'];
  if (!support_type || !VALID_SUPPORT.includes(support_type)) {
    return res.status(400).json({ error: 'validation', message: `support_type must be one of: ${VALID_SUPPORT.join(', ')}` });
  }

  try {
    const incident = await incidentRepo.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'not_found', message: 'Incident not found' });
    if (incident.status === 'resolved') {
      return res.status(409).json({ error: 'conflict', message: 'Cannot request support for a resolved incident' });
    }

    // first_responder must be assigned to this incident
    if (req.user.role === 'first_responder') {
      if (!incident.assigned_unit_id) {
        return res.status(403).json({ error: 'forbidden', message: 'Incident is not assigned to your vehicle' });
      }
      let responderVehicleIds: Set<string>;
      try {
        responderVehicleIds = await getVehiclesByDriver(req.user.sub, req.headers.authorization);
      } catch {
        return res.status(502).json({ error: 'tracking_unavailable', message: 'Could not resolve responder vehicle assignments' });
      }
      if (!responderVehicleIds.has(incident.assigned_unit_id)) {
        return res.status(403).json({ error: 'forbidden', message: 'You can only request support for incidents assigned to your vehicle' });
      }
    }

    const authHeader = req.headers.authorization;

    // Find and dispatch nearest available support unit — cross-org, any org with that vehicle type
    let ranked: (VehicleModel & { distance_km: number })[];
    try {
      ranked = await rankAvailableVehicles(support_type, incident.latitude, incident.longitude, authHeader);
    } catch {
      return res.status(503).json({ error: 'tracking_unavailable', message: 'Could not reach tracking service to find support units' });
    }

    if (!ranked.length) {
      return res.status(503).json({ error: 'no_vehicles', message: `No available ${support_type} units. Support request logged.` });
    }

    const supportUnit = await claimNearestVehicle(ranked, authHeader, req.params.id);
    if (!supportUnit) {
      return res.status(503).json({ error: 'no_vehicles', message: 'All matched support units became unavailable. Try again.' });
    }

    await incidentRepo.logStatusChange({
      incidentId: req.params.id,
      oldStatus: incident.status,
      newStatus: incident.status,
      changedBy: req.user.sub,
      notes: withAudit(req, `support requested: ${support_type}, dispatched unit ${supportUnit.id} (${supportUnit.license_plate}), distance ${supportUnit.distance_km.toFixed(2)} km`),
    });

    publish('incident.dispatched', {
      incident_id: req.params.id,
      assigned_unit_id: supportUnit.id,
      assigned_unit_type: support_type,
      distance_km: +supportUnit.distance_km.toFixed(2),
      dispatched_at: new Date().toISOString(),
      support: true,
    });

    res.status(201).json({
      message: `Support unit dispatched`,
      support_unit: {
        vehicle_id: supportUnit.id,
        vehicle_type: supportUnit.vehicle_type,
        license_plate: supportUnit.license_plate,
        distance_km: +supportUnit.distance_km.toFixed(2),
      },
    });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { create, listOpen, getOne, updateStatus, reassign, requestSupport };
