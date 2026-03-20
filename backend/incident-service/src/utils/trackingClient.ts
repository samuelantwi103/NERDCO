// Single responsibility: HTTP client for tracking-service calls made by incident-service
import type { VehicleModel } from '@nerdco/domain-types';

const axios = require('axios');

const TRACKING_URL = () => process.env.TRACKING_SERVICE_URL || 'http://localhost:3003';

export async function getVehicleById(vehicleId: string, authHeader: string): Promise<VehicleModel | null> {
  const { data } = await axios.get(`${TRACKING_URL()}/vehicles/${vehicleId}`, {
    headers: { authorization: authHeader },
  });
  return data?.vehicle || null;
}

export async function getAvailableVehicles(
  vehicleType: string,
  authHeader: string,
): Promise<VehicleModel[]> {
  const { data } = await axios.get(`${TRACKING_URL()}/vehicles`, {
    params: { type: vehicleType, status: 'available' },
    headers: { authorization: authHeader },
  });
  return data?.vehicles || [];
}

export async function getVehiclesByDriver(driverUserId: string, authHeader: string): Promise<Set<string>> {
  const { data } = await axios.get(`${TRACKING_URL()}/vehicles`, {
    headers: { authorization: authHeader },
    params: { driverUserId },
  });
  const vehicles: VehicleModel[] = data?.vehicles || [];
  return new Set(vehicles.map(v => v.id));
}

// incidentId is passed so tracking-service can record current_incident_id on the vehicle
// (spec requirement: vehicles store "Incident Service ID").
export async function dispatchVehicle(vehicleId: string, authHeader: string, incidentId: string): Promise<void> {
  await axios.put(`${TRACKING_URL()}/vehicles/${vehicleId}/status`, { status: 'dispatched', incident_id: incidentId }, {
    headers: { authorization: authHeader },
  });
}

export async function releaseVehicle(vehicleId: string, authHeader: string): Promise<void> {
  await axios.put(`${TRACKING_URL()}/vehicles/${vehicleId}/status`, { status: 'available' }, {
    headers: { authorization: authHeader },
  });
}
