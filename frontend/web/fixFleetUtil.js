const fs = require('fs');
let content = fs.readFileSync('frontend/web/src/app/(fleet)/fleet/analytics/page.tsx', 'utf8');

// 1. Add import
if (!content.includes('listOrganizations')) {
    content = content.replace(/import \{ getSummary, getResponseTimes, getUtilisation \} from '@\/lib\/api\/analytics';/,
    `import { getSummary, getResponseTimes, getUtilisation } from '@/lib/api/analytics';\nimport { listOrganizations } from '@/lib/api/auth';`);
}

// 2. Change useAutoRefresh block
let oldBlock = `const [s, t, u] = await Promise.all([getSummary(token), getResponseTimes(token), getUtilisation(token)]);
      setSummary(s);
      const byTypeObj = t?.by_type ?? {};
      setTimes(Object.entries(byTypeObj).map(([incident_type, d]: any) => ({ incident_type, ...d })));

      const rows: any[] = u?.utilization ?? [];
      const orgMap: Record<string, any> = {};
      for (const row of rows) {
        if (!orgMap[row.organization_id]) orgMap[row.organization_id] = { org_id: row.organization_id, total: 0, dispatched: 0 };
        orgMap[row.organization_id].total += +row.count;
        if (row.status === 'dispatched') orgMap[row.organization_id].dispatched += +row.count;
      }
      const allUtil = Object.values(orgMap);
      setUtil(user?.org ? allUtil.filter((o: any) => o.org_id === user.org) : allUtil);`;

let newBlock = `const [s, t, u, orgsRes] = await Promise.all([
        getSummary(token),
        getResponseTimes(token),
        getUtilisation(token),
        listOrganizations(token).catch(e => { console.error(e); return []; })
      ]);
      setSummary(s);
      const byTypeObj = t?.by_type ?? {};
      setTimes(Object.entries(byTypeObj).map(([incident_type, d]: any) => ({ incident_type, ...d })));
      
      const orgs = orgsRes?.organizations ?? orgsRes ?? [];
      const orgNameMap: Record<string, string> = {};
      orgs.forEach((o: any) => { if (o && o.id) orgNameMap[String(o.id).trim().toLowerCase()] = o.name; });

      const rows: any[] = u?.utilization ?? [];
      const orgMap: Record<string, any> = {};
      
      for (const row of rows) {
        const rowOrgId = String(row.organization_id).trim().toLowerCase();
        // Since fleet filters by user.org we keep the UUID around for filtering, but store name for display
        const name = orgNameMap[rowOrgId] || rowOrgId;
        
        if (!orgMap[rowOrgId]) {
            orgMap[rowOrgId] = { org_id: rowOrgId, display_name: name, total: 0, dispatched: 0 };
        }
        orgMap[rowOrgId].total += +row.count;
        if (row.status === 'dispatched') orgMap[rowOrgId].dispatched += +row.count;
      }
      
      const allUtil = Object.values(orgMap);
      setUtil(user?.org ? allUtil.filter((o: any) => o.org_id === String(user.org).trim().toLowerCase()) : allUtil);`;

content = content.replace(oldBlock, newBlock);

// 3. Output mapped name
content = content.replace(/\{org\.org_id\}\n\s+<\/Text>/g, `{org.display_name || org.org_id}\n              </Text>`);

fs.writeFileSync('frontend/web/src/app/(fleet)/fleet/analytics/page.tsx', content);
console.log('updated fleet analytics');
