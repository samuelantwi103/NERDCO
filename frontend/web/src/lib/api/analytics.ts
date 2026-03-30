import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_ANALYTICS_URL;

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getSummary(token: string) {
  const { data } = await axios.get(`${BASE}/analytics/summary`, { headers: headers(token) });
  return data;
}

export async function getResponseTimes(token: string) {
  const { data } = await axios.get(`${BASE}/analytics/response-times`, { headers: headers(token) });
  return data;
}

export async function getUtilisation(token: string) {
  const { data } = await axios.get(`${BASE}/analytics/resource-utilization`, { headers: headers(token) });
  return data;
}

export async function getBedUtilisation(token: string) {
  const { data } = await axios.get(`${BASE}/analytics/bed-utilization`, { headers: headers(token) });
  return data;
}

export async function getIncidentsByRegion(token: string, params?: { type?: string; from?: string; to?: string }) {
  const { data } = await axios.get(`${BASE}/analytics/incidents-by-region`, { params, headers: headers(token) });
  return (data.regions ?? []) as any[];
}

export async function getMostDeployed(token: string, params?: { vehicle_type?: string; from?: string; to?: string }) {
  const { data } = await axios.get(`${BASE}/analytics/most-deployed`, { params, headers: headers(token) });
  return (data.responders ?? []) as any[];
}
