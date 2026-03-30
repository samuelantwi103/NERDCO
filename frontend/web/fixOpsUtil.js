const fs = require('fs');
let content = fs.readFileSync('frontend/web/src/app/(ops)/analytics/page.tsx', 'utf8');

// replace map cleanly block
const oldBlock = `// Ensure we map cleanly
      orgs.forEach((o: any) => { if (o && o.id) orgNameMap[String(o.id).trim()] = o.name; });

      const rows: any[] = u?.utilization ?? [];
      const orgMap: Record<string, any> = {};
      for (const row of rows) {
        const rowOrgId = String(row.organization_id).trim();
        const name = orgNameMap[rowOrgId] || rowOrgId;`;

const newBlock = `// Ensure we map cleanly
      orgs.forEach((o: any) => { if (o && o.id) orgNameMap[String(o.id).trim().toLowerCase()] = o.name; });

      const rows: any[] = u?.utilization ?? [];
      const orgMap: Record<string, any> = {};
      for (const row of rows) {
        const rowOrgId = String(row.organization_id).trim().toLowerCase();
        const name = orgNameMap[rowOrgId] || rowOrgId;`;

let modified = content.replace(oldBlock, newBlock);
fs.writeFileSync('frontend/web/src/app/(ops)/analytics/page.tsx', modified);
console.log(modified === content ? 'No change made' : 'updated ops analytics');