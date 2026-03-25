// Orchestrates: validate → call repo → publish → broadcast → respond
const vehicleRepo = require('../repositories/vehicleRepo');
const { publish } = require('../utils/publisher');
const { broadcast } = require('../websocket/wsServer');

const VALID_TYPES   = ['ambulance', 'police_car', 'fire_truck'];
const VALID_STATUSES = ['available', 'dispatched', 'unavailable'];

function canManageVehicle(user, vehicle) {
  if (user.role === 'first_responder') {
    return vehicle.driver_user_id === user.sub;
  }
  if (user.role === 'org_admin') {
    return !!user.org && vehicle.organization_id === user.org;
  }
  return true; // system_admin
}

function canViewVehicle(user, vehicle) {
  return canManageVehicle(user, vehicle);
}

async function register(req: any, res: any) {
  const { organization_id, organization_type, vehicle_type, license_plate, driver_user_id, latitude, longitude } = req.body;
  if (!organization_id || !organization_type || !vehicle_type || !license_plate) {
    return res.status(400).json({ error: 'validation', message: 'organization_id, organization_type, vehicle_type and license_plate are required' });
  }
  if (!VALID_TYPES.includes(vehicle_type)) {
    return res.status(400).json({ error: 'validation', message: `vehicle_type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  try {
    const vehicle = await vehicleRepo.create({ organizationId: organization_id, organizationType: organization_type, vehicleType: vehicle_type, licensePlate: license_plate, driverUserId: driver_user_id, latitude, longitude });
    res.status(201).json({ vehicle });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'conflict', message: 'License plate already registered' });
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function list(req, res) {
  try {
    const filters = { ...req.query };
    if (req.user.role === 'first_responder') {
      filters.driverUserId = req.user.sub;
      delete filters.organizationId;
    } else if (req.user.role === 'org_admin') {
      filters.organizationId = req.user.org;
      delete filters.driverUserId;
    }
    res.status(200).json({ vehicles: await vehicleRepo.findAll(filters) });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getOne(req, res) {
  try {
    const vehicle = await vehicleRepo.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    if (!canViewVehicle(req.user, vehicle)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions for this vehicle' });
    }
    res.status(200).json({ vehicle });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getLocation(req, res) {
  try {
    const vehicle = await vehicleRepo.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    if (!canViewVehicle(req.user, vehicle)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions for this vehicle' });
    }
    res.status(200).json({ latitude: vehicle.latitude, longitude: vehicle.longitude, last_updated: vehicle.last_updated });
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
    const existing = await vehicleRepo.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    if (!canManageVehicle(req.user, existing)) {
      return res.status(403).json({ error: 'forbidden', message: 'You can only update your assigned vehicle' });
    }

    const vehicle = await vehicleRepo.updateLocation({ id: req.params.id, latitude, longitude });
    if (!vehicle) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });

    const recorded_at = new Date().toISOString();
    await vehicleRepo.saveLocationHistory({ vehicleId: vehicle.id, latitude, longitude, recordedAt: recorded_at });

    const payload = { vehicle_id: vehicle.id, vehicle_type: vehicle.vehicle_type, status: vehicle.status, latitude, longitude, recorded_at };
    publish('vehicle.location.updated', payload);
    broadcast({ type: 'vehicle.location.updated', payload });

    res.status(200).json({ message: 'Location updated' });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function updateStatus(req, res) {
  const { status, incident_id } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'validation', message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  // first_responder cannot set dispatched (dispatch is an operator/system action)
  if (req.user.role === 'first_responder' && status === 'dispatched') {
    return res.status(403).json({ error: 'forbidden', message: 'Field responders cannot set status to dispatched' });
  }
  try {
    const existing = await vehicleRepo.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    if (!canManageVehicle(req.user, existing)) {
      return res.status(403).json({ error: 'forbidden', message: 'You can only update your assigned vehicle' });
    }

    const vehicle = await vehicleRepo.updateStatus({ id: req.params.id, newStatus: status, incidentId: incident_id || null });
    if (!vehicle) {
      // Row exists but status condition failed — concurrent dispatch claimed it first
      return res.status(409).json({ error: 'conflict', message: 'Vehicle is no longer available' });
    }
    publish('vehicle.status.changed', {
      vehicle_id: vehicle.id, vehicle_type: vehicle.vehicle_type,
      organization_id: vehicle.organization_id, new_status: status,
      current_incident_id: vehicle.current_incident_id || null,
      changed_at: new Date().toISOString(),
    });
    res.status(200).json({ message: `Vehicle status updated to ${status}`, vehicle });
  } catch {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function updateVehicle(req, res) {
  const { id } = req.params;
  const { organization_id, organization_type, vehicle_type, license_plate, driver_user_id } = req.body;

  try {
    const existing = await vehicleRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    }

    if (req.user.role === 'org_admin') {
      if (existing.organization_id !== req.user.org) {
        return res.status(403).json({ error: 'forbidden', message: 'Cannot edit vehicles outside your organisation' });
      }
      if (organization_id && organization_id !== req.user.org) {
         return res.status(403).json({ error: 'forbidden', message: 'Cannot assign vehicles to another organisation' });
      }
    }

    if (vehicle_type && !VALID_TYPES.includes(vehicle_type)) {
      return res.status(400).json({ error: 'validation', message: `vehicle_type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const updates = {
      id,
      organizationId: organization_id !== undefined ? organization_id : existing.organization_id,
      organizationType: organization_type !== undefined ? organization_type : existing.organization_type,
      vehicleType: vehicle_type !== undefined ? vehicle_type : existing.vehicle_type,
      licensePlate: license_plate !== undefined ? license_plate : existing.license_plate,
      driverUserId: driver_user_id !== undefined ? driver_user_id : existing.driver_user_id,
    };

    const vehicle = await vehicleRepo.update(updates);
    res.status(200).json({ vehicle, message: 'Vehicle updated successfully' });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'conflict', message: 'License plate already registered' });
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function deleteVehicle(req, res) {
  try {
    const { id } = req.params;
    const existing = await vehicleRepo.findById(id);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });
    
    // Authorization check
    if (req.user.role === 'org_admin') {
      if (existing.organization_id !== req.user.org) {
        return res.status(403).json({ error: 'forbidden', message: 'Cannot delete vehicles outside your organisation' });
      }
    }
    
    await vehicleRepo.remove(id);
    res.status(200).json({ message: 'Vehicle deleted successfully' });
  } catch (err: any) {
    console.error('[deleteVehicle]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { register, list, getOne, getLocation, updateLocation, updateStatus, updateVehicle, deleteVehicle };
