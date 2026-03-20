// Single responsibility: HTTP client for auth-service calls made by incident-service
// Used exclusively for hospital capacity queries and adjustments.

const axios = require('axios');

const AUTH_URL            = () => process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const SERVICE_SECRET      = () => process.env.SERVICE_INTERNAL_SECRET || '';

function serviceHeaders() {
  return { 'x-service-secret': SERVICE_SECRET() };
}

export interface HospitalInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  beds_available: number;
  beds_total: number;
}

// Returns hospitals that currently have at least one bed available.
export async function getHospitalsWithCapacity(): Promise<HospitalInfo[]> {
  const { data } = await axios.get(`${AUTH_URL()}/organizations/hospitals/available`, {
    headers: serviceHeaders(),
  });
  return data?.hospitals || [];
}

// Adjust a hospital's beds_available by delta (-1 on dispatch, +1 on resolve).
// Silently ignores failures — a bed count going slightly off is better than
// blocking an emergency dispatch.
export async function adjustHospitalCapacity(hospitalId: string, delta: number): Promise<void> {
  await axios.patch(`${AUTH_URL()}/organizations/${hospitalId}/capacity`, { delta }, {
    headers: serviceHeaders(),
  });
}
