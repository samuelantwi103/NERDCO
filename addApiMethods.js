const fs = require('fs');
const apPath = 'frontend/web/src/lib/api/auth.ts';
let ap = fs.readFileSync(apPath, 'utf8');
ap += \

export async function updateUser(token: string, id: string, body: Partial<{ name: string; role: string; is_active: boolean; organization_id: string }>) {
  const { data } = await axios.put(\\\\/auth/users/\\\\\\, body, { headers: headers(token) });
  return data;
}

export async function deleteUser(token: string, id: string) {
  const { data } = await axios.delete(\\\\/auth/users/\\\\\\, { headers: headers(token) });
  return data;
}

export async function updateOrganization(token: string, id: string, body: Partial<{ name: string; type: string; latitude: number; longitude: number; address: string; phone: string }>) {
  const { data } = await axios.put(\\\\/organizations/\\\\\\, body, { headers: headers(token) });
  return data;
}

export async function deleteOrganization(token: string, id: string) {
  const { data } = await axios.delete(\\\\/organizations/\\\\\\, { headers: headers(token) });
  return data;
}
\;
fs.writeFileSync(apPath, ap);
