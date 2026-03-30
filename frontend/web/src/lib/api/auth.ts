import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_AUTH_URL;

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function listOrganizations(token: string) {
  const { data } = await axios.get(`${BASE}/organizations`, { headers: headers(token) });
  return data.organizations ?? data;
}

export async function createOrganization(token: string, body: {
  name: string; type: string; latitude: number; longitude: number;
  address?: string; phone?: string; beds_available?: number; beds_total?: number;
}) {
  const { data } = await axios.post(`${BASE}/organizations`, body, { headers: headers(token) });
  return data;
}

export async function listUsers(token: string, includeDeleted = false) {
  const params = includeDeleted ? '?include_deleted=true' : '';
  const { data } = await axios.get(`${BASE}/auth/users${params}`, { headers: headers(token) });
  return data.users as any[];
}

export async function createUser(token: string, body: {
  name: string; email: string; role: string; organization_id?: string;
}) {
  const { data } = await axios.post(`${BASE}/auth/users`, body, { headers: headers(token) });
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await axios.post(`${BASE}/auth/forgot-password`, { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string) {
  const { data } = await axios.post(`${BASE}/auth/reset-password`, { token, new_password: newPassword });
  return data;
}

export async function getHospitalsWithCapacity(token: string, orgId?: string | null) {
  if (orgId) {
    // org_admin: fetch their single hospital directly (works even when beds_available = 0)
    const { data } = await axios.get(`${BASE}/organizations/${orgId}`, { headers: headers(token) });
    return { hospitals: [data] };
  }
  // system_admin: fetch all hospitals
  const { data } = await axios.get(`${BASE}/organizations/hospitals/available`, { headers: headers(token) });
  return data;
}

export async function updateCapacity(token: string, orgId: string, bedsAvailable: number, bedsTotal?: number) {
  const { data } = await axios.patch(`${BASE}/organizations/${orgId}/capacity`,
    { beds_available: bedsAvailable, beds_total: bedsTotal },
    { headers: headers(token) }
  );
  return data;
}


export async function updateOrganization(token: string, id: string, body: any) {
  const { data } = await axios.put(`${BASE}/organizations/${id}`, body, { headers: headers(token) });
  return data;
}

export async function deleteOrganization(token: string, id: string) {
  const { data } = await axios.delete(`${BASE}/organizations/${id}`, { headers: headers(token) });
  return data;
}

export async function updateUser(token: string, id: string, body: any) {
  const { data } = await axios.put(`${BASE}/auth/users/${id}`, body, { headers: headers(token) });
  return data;
}

export async function deleteUser(token: string, id: string) {
  const { data } = await axios.delete(`${BASE}/auth/users/${id}`, { headers: headers(token) });
  return data;
}

export async function restoreUser(token: string, id: string) {
  const { data } = await axios.post(`${BASE}/auth/users/${id}/restore`, {}, { headers: headers(token) });
  return data;
}

export async function hardDeleteUser(token: string, id: string) {
  const { data } = await axios.delete(`${BASE}/auth/users/${id}/permanent`, { headers: headers(token) });
  return data;
}

export async function updateProfile(token: string, body: any) {
  const { data } = await axios.put(`${BASE}/auth/profile`, body, { headers: headers(token) });
  return data;
}
