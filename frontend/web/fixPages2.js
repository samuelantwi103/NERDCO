const fs = require('fs');

const pathUsers = 'src/app/(ops)/admin/users/page.tsx';
let dUsers = fs.readFileSync(pathUsers, 'utf8');

if (!dUsers.includes('ErrorState')) {
  dUsers = dUsers.replace("import { PageShell }", "import { ErrorState } from '@/components/ui/ErrorState';\nimport { PageShell }");
  dUsers = dUsers.replace("const [loading,  setLoading]  = useState(true);", "const [loading,  setLoading]  = useState(true);\n  const [pageError, setPageError] = useState<string | null>(null);");
  dUsers = dUsers.replace(/useAutoRefresh\(async \(\) => \{\n\s+try \{\n\s+const \[u, o\] = await Promise\.all\(\[listUsers\(token, showDeleted\), listOrganizations\(token\)\]\);\n\s+setUsers\(u\);\n\s+setOrgs\(o\);\n\s+\} finally \{ setLoading\(false\); \}\n\s+\}, POLLING\.ADMIN\);/, 
  `const loadData = async () => {
    try {
      setPageError(null);
      const [u, o] = await Promise.all([listUsers(token, showDeleted), listOrganizations(token)]);
      setUsers(u);
      setOrgs(o);
    } catch (err: any) {
      setPageError(err?.message || 'Failed to load users');
    } finally { setLoading(false); }
  };
  useAutoRefresh(loadData, POLLING.ADMIN);`);

  dUsers = dUsers.replace(/<PageShell[^>]*?>/, (match) => match + '\n      {pageError ? <ErrorState message={pageError} onRetry={loadData} /> : <>');
  dUsers = dUsers.replace(/<\/PageShell>(?![\s\S]*<\/PageShell>)/, "</>\n      }\n    </PageShell>");
  fs.writeFileSync(pathUsers, dUsers);
  console.log("Updated users");
} else {
  console.log("Users already has ErrorState");
}
