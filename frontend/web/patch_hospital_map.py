import sys
import re

with open('src/app/(fleet)/fleet/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add useSWR import if not there
if 'import useSWR' not in text:
    text = text.replace(\"import { useState } from 'react';\", \"import { useState } from 'react';\\nimport useSWR from 'swr';\")

# Add hospital location request to HospitalDashboard
hospital_fetch = \"\"\"
  const { user } = useAuth();
  const token = user?.access_token ?? '';
  const { data: orgData } = useSWR(orgId ? ['org', orgId] : null, async () => {
    const res = await fetch(\\/organizations/\\, { headers: { Authorization: \Bearer \\ } });
    if (!res.ok) throw new Error('fetch org failed');
    return res.json();
  });
  const myLocation = orgData?.latitude && orgData?.longitude 
    ? { lat: parseFloat(orgData.latitude), lng: parseFloat(orgData.longitude) } 
    : undefined;
\"\"\"

# Inject it
text = re.sub(
    r'(function HospitalDashboard.*?\{[\s\S]*?const styles = useStyles\(\);)',
    r'\g<1>\n' + hospital_fetch,
    text
)

# Replace the Map component
text = text.replace(
    '<DashboardMap\\n              incidents={medical}',
    '<DashboardMap\\n              myLocation={myLocation}\\n              incidents={medical}'
)

with open('src/app/(fleet)/fleet/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
