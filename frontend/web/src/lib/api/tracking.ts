import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_TRACKING_URL;

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function listVehicles(token: string) {
  const { data } = await axios.get(`${BASE}/vehicles`, { headers: headers(token) });
  return (data.vehicles ?? data) as any[];
}

export async function getVehicle(token: string, id: string) {
  const { data } = await axios.get(`${BASE}/vehicles/${id}`, { headers: headers(token) });
  return (data.vehicle ?? data) as any;
}

export async function createVehicle(token: string, body: {
  license_plate:     string;
  vehicle_type:      string;
  organization_id:   string;
  organization_type: string;
  driver_user_id?:   string;
  latitude?:         number;
  longitude?:        number;
}) {
  const { data } = await axios.post(`${BASE}/vehicles/register`, body, { headers: headers(token) });
  return data;
}

export async function updateVehicleStatus(token: string, id: string, status: string) {
  const { data } = await axios.put(`${BASE}/vehicles/${id}/status`, { status }, { headers: headers(token) });
  return data;
}

export async function updateVehicleLocation(token: string, id: string, latitude: number, longitude: number) {
  const { data } = await axios.put(`${BASE}/vehicles/${id}/location`, { latitude, longitude }, { headers: headers(token) });
  return data;
}

export async function updateVehicle(token: string, id: string, body: any) {
  const { data } = await axios.put(`${BASE}/vehicles/${id}`, body, { headers: headers(token) });
  return data;
}

export async function deleteVehicle(token: string, id: string) {
  const { data } = await axios.delete(`${BASE}/vehicles/${id}`, { headers: headers(token) });
  return data;
}
export async function startSimulationRun(token: string, id: string, body: any) {
  const { data } = await axios.post(`${BASE}/simulations/${id}/start`, body, { headers: headers(token) });
  return data;
}

export async function stopSimulationRun(token: string, id: string) {
  const { data } = await axios.post(`${BASE}/simulations/${id}/stop`, {}, { headers: headers(token) });
  return data;
}

export async function resumeSimulationRun(token: string, id: string) {
  const { data } = await axios.post(`${BASE}/simulations/${id}/resume`, {}, { headers: headers(token) });
  return data;
}

export async function getActiveSimulations(token: string) {
  const { data } = await axios.get(`${BASE}/simulations/active?_t=${Date.now()}`, { headers: headers(token) });
  return data; // returns { simulations: [], past: [] }
}
