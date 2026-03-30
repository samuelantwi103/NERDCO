import { readFileSync, writeFileSync } from 'fs';

function addErrorState(filepath, patternToReplace, replacement) {
  let content = readFileSync(filepath, 'utf8');
  if (!content.includes("import { ErrorState }")) {
    content = content.replace(/(import[\s\S]+?from\s+['"][^'"]+['"];)/, `$1\nimport { ErrorState } from '@/components/ui/ErrorState';`);
  }
  content = content.replace(patternToReplace, replacement);
  writeFileSync(filepath, content, 'utf8');
}

addErrorState(
  'src/app/(ops)/admin/organizations/page.tsx', 
  /const \[loading,  setLoading\]  = useState\(true\);\s+const \[open,     setOpen\]     = useState\(false\);/,
  `const [loading,  setLoading]  = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  
  // Modals
  const [open,     setOpen]     = useState(false);`
);

// We need to alter useAutoRefresh in organizations to use pageError:
let orgContent = readFileSync('src/app/(ops)/admin/organizations/page.tsx', 'utf8');
orgContent = orgContent.replace(
  /useAutoRefresh\(async \(\) => \{\n\s+try \{ setOrgs\(await listOrganizations\(token\)\); \}\n\s+finally \{ setLoading\(false\); \}\n\s+\}, POLLING\.ADMIN\);/,
  `const loadOrgs = async () => {
    try { 
      setPageError(null);
      setOrgs(await listOrganizations(token)); 
    } catch (err: any) {
      setPageError(err.message || 'Failed to load organizations');
    } finally { setLoading(false); }
  };
  useAutoRefresh(loadOrgs, POLLING.ADMIN);`
);

// Next we add ErrorState render down in PageShell:
orgContent = orgContent.replace(
  /\{viewMode === 'map' \?/g,
  `{pageError ? (
        <ErrorState message={pageError} onRetry={loadOrgs} />
      ) : viewMode === 'map' ?`
);
writeFileSync('src/app/(ops)/admin/organizations/page.tsx', orgContent, 'utf8');
