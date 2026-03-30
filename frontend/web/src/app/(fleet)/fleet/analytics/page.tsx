'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text } from '@fluentui/react-components';
import { useAuth } from '@/lib/context/AuthContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { getResponseTimes } from '@/lib/api/analytics';
import { listVehicles } from '@/lib/api/tracking';
import { POLLING } from '@/lib/config/polling';
import { PageShell }   from '@/components/ui/PageShell';
import { StatCard }    from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { DataTable, type Column } from '@/components/ui/DataTable';

function fmtSeconds(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const responseColumns: Column<any>[] = [
  { key: 'type',  label: 'Type',           width: '120px', render: r => <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{r.incident_type}</span> },
  { key: 'count', label: 'Incidents',      width: '100px', render: r => r.count ?? '—' },
  { key: 'avg',   label: 'Avg response',   width: '120px', render: r => fmtSeconds(r.avg_secs) },
  { key: 'min',   label: 'Best',           width: '100px', render: r => fmtSeconds(r.min_secs) },
  { key: 'max',   label: 'Worst',                          render: r => fmtSeconds(r.max_secs) },
];

function FleetAnalyticsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const token = user?.access_token ?? '';

  useEffect(() => {
    if (!user) router.replace('/login');
    else if (user.role !== 'org_admin') router.replace('/dashboard');
  }, [user, router]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [times,     setTimes]     = useState<any[]>([]);
  const [vehicles,  setVehicles]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  useAutoRefresh(async () => {
    if (!token) return;
    const [t, v] = await Promise.all([
      getResponseTimes(token),
      listVehicles(token).catch(() => [] as any[]),
    ]);

    // Response times — all types (org-admin sees their own incidents via backend auth)
    const byTypeObj = t?.by_type ?? {};
    setTimes(Object.entries(byTypeObj).map(([incident_type, d]: any) => ({ incident_type, ...d })));

    // Vehicles scoped to this org
    const orgVehicles = (v as any[]).filter((veh: any) => veh.organization_id === user?.org);
    setVehicles(orgVehicles);
    setLoading(false);
  }, POLLING.ANALYTICS);

  if (!mounted || !user || user.role !== 'org_admin') return null;

  const totalVehicles      = vehicles.length;
  const availableVehicles  = vehicles.filter(v => v.status === 'available').length;
  const dispatchedVehicles = vehicles.filter(v => v.status === 'dispatched').length;
  const unavailVehicles    = vehicles.filter(v => v.status === 'unavailable').length;
  const dispatchPct        = totalVehicles > 0 ? Math.round((dispatchedVehicles / totalVehicles) * 100) : 0;

  return (
    <PageShell title="Fleet Analytics" subtitle="Performance metrics for your fleet" loading={loading}>

      {/* Vehicle status summary */}
      <SectionCard title="Fleet Status">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <StatCard label="Available"   value={availableVehicles}  accentColor="var(--color-success)" />
          <StatCard label="Dispatched"  value={dispatchedVehicles} accentColor="var(--color-warning)" />
          <StatCard label="Unavailable" value={unavailVehicles}    accentColor="var(--color-text-muted)" />
          <StatCard label="Total fleet" value={totalVehicles}      accentColor="var(--color-accent)" />
        </div>

        {/* Dispatch utilisation bar */}
        {totalVehicles > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <Text style={{ fontSize: '13px', fontWeight: '600' }}>Utilisation</Text>
              <Text style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {dispatchedVehicles}/{totalVehicles} vehicles dispatched ({dispatchPct}%)
              </Text>
            </div>
            <div style={{ height: '8px', background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${dispatchPct}%`, height: '100%', background: 'var(--color-warning)', borderRadius: 'var(--radius-full)', transition: 'width 400ms ease' }} />
            </div>

            {/* Per-vehicle breakdown */}
            {vehicles.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {vehicles.map((v: any) => {
                  const statusColor = v.status === 'available' ? '#107C10' : v.status === 'dispatched' ? '#FF8C00' : '#797775';
                  return (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: '600', minWidth: '100px' }}>{v.license_plate}</span>
                      <span style={{ color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{(v.vehicle_type ?? '').replace(/_/g, ' ')}</span>
                      <span style={{ marginLeft: 'auto', color: statusColor, fontWeight: '600', textTransform: 'capitalize' }}>{v.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Response times */}
      <SectionCard title="Response times by incident type">
        <DataTable
          columns={responseColumns}
          rows={times}
          rowKey={r => r.incident_type}
          emptyTitle="No response data yet"
          emptyDescription="Response times appear once incidents have been resolved."
        />
      </SectionCard>
    </PageShell>
  );
}

export default function FleetAnalyticsPage() {
  return <Suspense><FleetAnalyticsContent /></Suspense>;
}
