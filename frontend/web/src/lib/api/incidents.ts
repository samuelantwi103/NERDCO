import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_INCIDENT_URL;

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function listOpenIncidents(token: string) {
  const { data } = await axios.get(`${BASE}/incidents/open`, { headers: headers(token) });
  return (data.incidents ?? data) as any[];
}

export async function getIncident(token: string, id: string) {
  const { data } = await axios.get(`${BASE}/incidents/${id}`, { headers: headers(token) });
  return (data.incident ?? data) as any;
}

export async function createIncident(token: string, body: {
  incident_type: string;
  latitude:      number;
  longitude:     number;
  location_name?: string;
  citizen_name?:  string;
  notes?:         string;
  unit_count?:    number;
  mci_units?:     Record<string, number>;
  required_capability?: string;
}) {
  const { data } = await axios.post(`${BASE}/incidents`, body, { headers: headers(token) });
  return data;
}

export async function updateIncidentStatus(token: string, id: string, status: string, notes?: string) {
  const { data } = await axios.put(`${BASE}/incidents/${id}/status`, { status, notes }, { headers: headers(token) });
  return data;
}

export async function reassignIncident(token: string, id: string, vehicleId: string) {
  const { data } = await axios.put(`${BASE}/incidents/${id}/assign`, { vehicle_id: vehicleId }, { headers: headers(token) });
  return data;
}

export async function requestSupport(token: string, id: string, body: { support_type?: string; notes?: string }) {
  const { data } = await axios.post(`${BASE}/incidents/${id}/request-support`, body, { headers: headers(token) });
  return data;
}

export async function getRelatedIncidents(token: string, id: string) {
  const { data } = await axios.get(`${BASE}/incidents/${id}/related`, { headers: headers(token) });
  return (data.incidents ?? []) as any[];
}
