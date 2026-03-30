'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text } from '@fluentui/react-components';
import { DataBarVerticalRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { getSummary, getResponseTimes, getUtilisation } from '@/lib/api/analytics';
import { listOrganizations } from '@/lib/api/auth';
import { POLLING } from '@/lib/config/polling';
import { PageShell }   from '@/components/ui/PageShell';
import { StatCard }    from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState }  from '@/components/ui/EmptyState';
import { DataTable, type Column } from '@/components/ui/DataTable';

function fmtSeconds(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const responseColumns: Column<any>[] = [
  { key: 'type',  label: 'Type',      width: '120px', render: r => <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{r.incident_type}</span> },
  { key: 'count', label: 'Incidents', width: '100px', render: r => r.count ?? '—' },
  { key: 'avg',   label: 'Avg response',             render: r => fmtSeconds(r.avg_secs) },
];

export default function FleetAnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const token = user?.access_token ?? '';

  useEffect(() => {
    if (!user) router.replace('/login');
    else if (user.role !== 'org_admin') router.replace('/dashboard');
  }, [user, router]);

  const [summary, setSummary] = useState<any>(null);
  const [times,   setTimes]   = useState<any[]>([]);
  const [util,    setUtil]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useAutoRefresh(async () => {
    if (!token) return;
    try {
      const [s, t, u, orgsRes] = await Promise.all([
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
        const name = orgNameMap[rowOrgId] || rowOrgId;
        if (!orgMap[rowOrgId]) {
          orgMap[rowOrgId] = { org_id: rowOrgId, display_name: name, total: 0, dispatched: 0 };
        }
        orgMap[rowOrgId].total += +row.count;
        if (row.status === 'dispatched') orgMap[rowOrgId].dispatched += +row.count;
      }
      const allUtil = Object.values(orgMap);
      setUtil(user?.org ? allUtil.filter((o: any) => o.org_id === String(user.org).trim().toLowerCase()) : allUtil);
    } finally { setLoading(false); }
  }, POLLING.ANALYTICS);

  if (!user || user.role !== 'org_admin') return null;

  return (
    <PageShell title="Fleet Analytics" subtitle="Performance metrics for your fleet" loading={loading}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <StatCard label="Incidents today"   value={summary?.incidents_today ?? '—'} accentColor="var(--color-fire)" />
        <StatCard label="Open incidents"    value={summary?.open_incidents  ?? '—'} accentColor="var(--color-warning)" />
        <StatCard label="Avg response time" value={summary?.avg_response_time_secs_today != null ? fmtSeconds(summary.avg_response_time_secs_today) : '—'} accentColor="var(--color-medical)" />
      </div>

      <SectionCard title="Response times by type">
        <DataTable columns={responseColumns} rows={times} rowKey={r => r.incident_type} emptyTitle="No data yet" />
      </SectionCard>

      <SectionCard title="Utilisation">
        {util.length === 0 ? (
          <EmptyState icon={<DataBarVerticalRegular />} title="No utilisation data" />
        ) : util.map((org: any) => {
          const pct = org.total > 0 ? Math.round((org.dispatched / org.total) * 100) : 0;
          return (
            <div key={org.org_id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '7px 0' }}>
              <Text style={{ width: '200px', fontSize: '13px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {org.display_name || org.org_id}
              </Text>
              <div style={{ flex: 1, height: '7px', background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gray-900)', borderRadius: 'var(--radius-full)', transition: 'width 400ms ease' }} />
              </div>
              <Text style={{ width: '38px', textAlign: 'right', fontSize: '12px', color: 'var(--color-text-muted)' }}>{pct}%</Text>
            </div>
          );
        })}
      </SectionCard>
    </PageShell>
  );
}
