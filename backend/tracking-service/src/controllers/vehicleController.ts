// Orchestrates: validate → call repo → publish → broadcast → respond
const vehicleRepo = require('../repositories/vehicleRepo');
const { publish } = require('../utils/publisher');
const { broadcast } = require('../websocket/wsServer');

const VALID_TYPES   = ['ambulance', 'police_car', 'fire_truck'];
const VALID_STATUSES = ['available', 'dispatched', 'unavailable'];

async function register(req, res) {
  const { organization_id, organization_type, vehicle_type, license_plate, driver_user_id } = req.body;
  if (!organization_id || !organization_type || !vehicle_type || !license_plate) {
    return res.status(400).json({ error: 'validation', message: 'organization_id, organization_type, vehicle_type and license_plate are required' });
  }
  if (!VALID_TYPES.includes(vehicle_type)) {
    return res.status(400).json({ error: 'validation', message: `vehicle_type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  try {
    const vehicle = await vehicleRepo.create({ organizationId: organization_id, organizationType: organization_type, vehicleType: vehicle_type, licensePlate: license_plate, driverUserId: driver_user_id });
    res.status(201).json({ vehicle });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'conflict', message: 'License plate already registered' });
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function list(req, res) {
  try {
    res.json({ vehicles: await vehicleRepo.findAll(req.query) });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getOne(req, res) {
  try {
    const vehicle = await vehicleRepo.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    res.json({ vehicle });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getLocation(req, res) {
  try {
    const vehicle = await vehicleRepo.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    res.json({ latitude: vehicle.latitude, longitude: vehicle.longitude, last_updated: vehicle.last_updated });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function updateLocation(req, res) {
  const { latitude, longitude } = req.body;
  if (latitude == null || longitude == null) {
    return res.status(400).json({ error: 'validation', message: 'latitude and longitude are required' });
  }
  try {
    const vehicle = await vehicleRepo.updateLocation({ id: req.params.id, latitude, longitude });
    if (!vehicle) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });

    const recorded_at = new Date().toISOString();
    await vehicleRepo.saveLocationHistory({ vehicleId: vehicle.id, latitude, longitude, recordedAt: recorded_at });

    const payload = { vehicle_id: vehicle.id, vehicle_type: vehicle.vehicle_type, status: vehicle.status, latitude, longitude, recorded_at };
    publish('vehicle.location.updated', payload);
    broadcast({ type: 'vehicle.location.updated', payload });

    res.json({ message: 'Location updated' });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function updateStatus(req, res) {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'validation', message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  try {
    const vehicle = await vehicleRepo.updateStatus({ id: req.params.id, newStatus: status });
    if (!vehicle) {
      // Row exists but status condition failed — concurrent dispatch claimed it first
      return res.status(409).json({ error: 'conflict', message: 'Vehicle is no longer available' });
    }
    publish('vehicle.status.changed', {
      vehicle_id: vehicle.id, vehicle_type: vehicle.vehicle_type,
      organization_id: vehicle.organization_id, new_status: status, changed_at: new Date().toISOString(),
    });
    res.json({ message: `Vehicle status updated to ${status}` });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { register, list, getOne, getLocation, updateLocation, updateStatus };
