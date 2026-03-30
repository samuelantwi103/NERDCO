'use client';
import { useState, Suspense } from 'react';
import { Text, TabList, Tab } from '@fluentui/react-components';
import { DataBarVerticalRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { getSummary, getResponseTimes, getUtilisation } from '@/lib/api/analytics';
import { listOrganizations } from '@/lib/api/auth';
import { POLLING } from '@/lib/config/polling';
import { PageShell } from '@/components/ui/PageShell';
import { StatCard }  from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DataTable, type Column } from '@/components/ui/DataTable';

function fmtSeconds(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '7px 0' }}>
      <Text style={{ width: '180px', fontSize: '13px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </Text>
      <div style={{ flex: 1, height: '7px', background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-warning)', borderRadius: 'var(--radius-full)', transition: 'width 400ms ease' }} />
      </div>
      <Text style={{ width: '38px', textAlign: 'right', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        {pct}%
      </Text>
    </div>
  );
}

const responseColumns: Column<any>[] = [
  { key: 'type',  label: 'Type',     width: '120px', render: r => <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{r.incident_type}</span> },
  { key: 'count', label: 'Incidents', width: '100px', render: r => r.count ?? '—' },
  { key: 'avg',   label: 'Avg',       width: '100px', render: r => fmtSeconds(r.avg_secs) },
  { key: 'min',   label: 'Min',       width: '100px', render: r => fmtSeconds(r.min_secs) },
  { key: 'max',   label: 'Max',                       render: r => fmtSeconds(r.max_secs) },
];

function AnalyticsContent() {
  const { user } = useAuth();
  const token = user?.access_token ?? '';

  const [viewMode,     setViewMode]     = useState<'operational' | 'historical'>('operational');
  const [summary,      setSummary]      = useState<any>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [times,        setTimes]        = useState<any[]>([]);
  const [timesError,   setTimesError]   = useState<string | null>(null);
  const [util,         setUtil]         = useState<any[]>([]);
  const [utilError,    setUtilError]    = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);

  const load = async () => {
    if (!token) return;

    // Fetch summary independently
    try {
      const s = await getSummary(token);
      setSummary(s);
      setSummaryError(null);
    } catch {
      setSummaryError('Failed to load summary stats');
    }

    // Fetch response times independently
    try {
      const t = await getResponseTimes(token);
      const byTypeObj = t?.by_type ?? {};
      setTimes(Object.entries(byTypeObj).map(([incident_type, d]: any) => ({ incident_type, ...d })));
      setTimesError(null);
    } catch {
      setTimesError('Failed to load response times');
    }

    // Fetch utilisation (requires org names from auth service)
    try {
      const [u, orgsRes] = await Promise.all([
        getUtilisation(token),
        listOrganizations(token).catch(e => { console.error(e); return []; }),
      ]);
      const orgs = orgsRes?.organizations ?? orgsRes ?? [];
      const orgNameMap: Record<string, string> = {};
      // Ensure we map cleanly
      orgs.forEach((o: any) => { if (o && o.id) orgNameMap[String(o.id).trim().toLowerCase()] = o.name; });
      const rows: any[] = u?.utilization ?? [];
      const orgMap: Record<string, any> = {};
      for (const row of rows) {
        const rowOrgId = String(row.organization_id).trim().toLowerCase();
        const name = orgNameMap[rowOrgId] || rowOrgId;
        if (!orgMap[name]) orgMap[name] = { org_id: name, total: 0, dispatched: 0 };
        orgMap[name].total += +row.count;
        if (row.status === 'dispatched') orgMap[name].dispatched += +row.count;
      }
      setUtil(Object.values(orgMap));
      setUtilError(null);
    } catch {
      setUtilError('Failed to load utilisation data');
    }

    setLoading(false);
  };

  useAutoRefresh(load, POLLING.ANALYTICS);

  const maxUtil = Math.max(...util.map((o: any) => o.total ?? 1), 1);

  const statCards = [
    { label: 'Incidents today',    value: summary?.incidents_today ?? '—',                                                                           color: 'var(--color-fire)',    subtitle: 'today' },
    { label: 'Open incidents',     value: summary?.open_incidents ?? '—',                                                                            color: 'var(--color-warning)', subtitle: 'right now' },
    { label: 'Avg response time',  value: summary?.avg_response_time_secs_today != null ? fmtSeconds(summary.avg_response_time_secs_today) : '—',    color: 'var(--color-medical)', subtitle: 'today · dispatched → resolved' },
    { label: 'Available vehicles', value: summary?.vehicles_available ?? '—',                                                                        color: 'var(--color-success)', subtitle: 'right now' },
  ];

  return (
    <PageShell title="Analytics" subtitle="Real-time operational metrics across all agencies" loading={loading}>
      {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {summaryError ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <ErrorState message={summaryError} onRetry={load} />
              </div>
            ) : (
              statCards.map(s => (
                <StatCard key={s.label} label={s.label} value={s.value} accentColor={s.color} subtitle={s.subtitle} />
              ))
            )}
          </div>

          {/* Response times */}
          <SectionCard title="Response times by incident type">
            {timesError ? (
              <ErrorState message={timesError} onRetry={load} />
            ) : (
              <DataTable
                columns={responseColumns}
                rows={times}
                rowKey={r => r.incident_type}
                emptyTitle="No response data yet"
                emptyDescription="Response time data will appear once incidents have been resolved."
              />
            )}
          </SectionCard>

          {/* Utilisation */}
          <SectionCard title="Resource utilisation by organisation">
            {utilError ? (
              <ErrorState message={utilError} onRetry={load} />
            ) : util.length === 0 ? (
              <EmptyState icon={<DataBarVerticalRegular />} title="No utilisation data" description="Utilisation data will appear once vehicles are registered and dispatched." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {util.map((org: any) => (
                  <BarRow key={org.org_id} label={org.org_id} value={org.dispatched} max={org.total} />
                ))}
              </div>
            )}
          </SectionCard>
    </PageShell>
  );
}

export default function AnalyticsPage() {
  return <Suspense><AnalyticsContent /></Suspense>;
}
