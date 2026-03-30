const fs = require('fs');
const file = 'src/lib/api/auth.ts';
let code = fs.readFileSync(file, 'utf8');

const newMethods = `

export async function updateOrganization(token: string, id: string, body: any) {
  const { data } = await axios.put(\`\${BASE}/organizations/\${id}\`, body, { headers: headers(token) });
  return data;
}

export async function deleteOrganization(token: string, id: string) {
  const { data } = await axios.delete(\`\${BASE}/organizations/\${id}\`, { headers: headers(token) });
  return data;
}

export async function updateUser(token: string, id: string, body: any) {
  const { data } = await axios.put(\`\${BASE}/auth/users/\${id}\`, body, { headers: headers(token) });
  return data;
}

export async function deleteUser(token: string, id: string) {
  const { data } = await axios.delete(\`\${BASE}/auth/users/\${id}\`, { headers: headers(token) });
  return data;
}
`;

fs.appendFileSync(file, newMethods);
console.log('Added methods');