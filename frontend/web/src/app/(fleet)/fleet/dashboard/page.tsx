'use client';
/**
 * Fleet Dashboard — map-first view for all org_admin roles.
 * Shows: the admin's own facility, their vehicles, and relevant incidents on the map.
 * A collapsible sidebar on the right lists vehicle statuses and active incidents.
 */
import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Badge, Spinner, makeStyles } from '@fluentui/react-components';
import { AlertUrgentRegular, VehicleCarRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { VehicleStatusBadge, IncidentStatusBadge } from '@/components/StatusBadge';
import { IncidentTypeChip } from '@/components/IncidentTypeChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFleetDashboard } from './useFleetDashboard';
import { DashboardMap, type Facility } from '@/app/(ops)/dashboard/DashboardMap';
import { listOrganizations } from '@/lib/api/auth';

const TOGGLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '6px 0 0 6px',
  width: '20px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  boxShadow: 'var(--shadow-sm)',
  userSelect: 'none',
};

const useStyles = makeStyles({
  sidebar: {
    width: '300px', minWidth: '300px',
    background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 10,
  },
  sectionHead: { fontWeight: 700, fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '14px 16px 6px' },
  vRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 16px', borderBottom: '1px solid var(--color-border)',
    fontSize: '13px',
  },
  incRow: {
    padding: '10px 16px', borderBottom: '1px solid var(--color-border)',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
    ':hover': { background: 'var(--color-bg)' },
  },
});

function FleetDashboardContent() {
  const styles  = useStyles();
  const { user } = useAuth();
  const router  = useRouter();
  const token   = user?.access_token ?? '';

  useEffect(() => {
    if (!user) router.replace('/login');
    else if (user.role !== 'org_admin') router.replace('/dashboard');
  }, [user, router]);

  const { state, actions } = useFleetDashboard(token);
  const { vehicles, incidents, selectedIncId, loading } = state;

  const [mounted,      setMounted]      = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [facilities,   setFacilities]   = useState<Facility[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Fetch all orgs once to get facility positions
  useEffect(() => {
    if (!token) return;
    listOrganizations(token).then(orgs => {
      const facs: Facility[] = orgs
        .filter((o: any) => o.latitude && o.longitude)
        .map((o: any) => ({
          id:           o.id,
          lat:          parseFloat(o.latitude),
          lng:          parseFloat(o.longitude),
          name:         o.name,
          type:         o.type ?? o.org_type ?? 'hospital',
          isMyFacility: o.id === user?.org,
        }));
      setFacilities(facs);
    }).catch(() => {});
  }, [token, user?.org]);

  if (!mounted || !user || user.role !== 'org_admin') return null;

  // Filter incidents relevant to this org (vehicles belonging to this org)
  const myIncidents = incidents.filter(i =>
    vehicles.some(v => v.id === (i.assigned_unit_id || i.assigned_vehicle_id))
  );

  const available   = vehicles.filter(v => v.status === 'available').length;
  const dispatched  = vehicles.filter(v => v.status === 'dispatched').length;

  // Map shows only vehicles + incidents relevant to this org + all facilities
  const mapVehicles  = vehicles;
  const mapIncidents = myIncidents;

  const orgLabel: Record<string, string> = {
    hospital:          'Hospital Dashboard',
    ambulance_service: 'Ambulance Dashboard',
    police_station:    'Police Dashboard',
    fire_station:      'Fire Station Dashboard',
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', position: 'relative', background: 'var(--color-bg)' }}>
      {/* ── Map (fills all remaining space) ──────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        {loading && vehicles.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Spinner size="large" label="Loading fleet data…" />
          </div>
        ) : (
          <DashboardMap
            incidents={mapIncidents}
            vehicles={mapVehicles}
            facilities={facilities}
            selectedId={selectedIncId}
            onSelect={actions.setSelectedIncId}
            hidePOIs={true}
          />
        )}

        {/* Stat badges floating over map, top-left */}
        <div style={{
          position: 'absolute', top: '12px', left: '12px', zIndex: 10,
          display: 'flex', gap: '8px', flexWrap: 'wrap',
        }}>
          <div style={{ background: 'rgba(0,0,0,0.72)', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>
            {orgLabel[user.org_type ?? ''] ?? 'Fleet Dashboard'}
          </div>
          <div style={{ background: 'rgba(16,124,16,0.85)', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>
            {available} Available
          </div>
          <div style={{ background: 'rgba(255,140,0,0.85)', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>
            {dispatched} Dispatched
          </div>
          <div style={{ background: 'rgba(230,57,70,0.85)', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>
            {myIncidents.filter(i => i.status !== 'resolved').length} Active incidents
          </div>
        </div>

        {/* Sidebar toggle */}
        <div
          style={{ ...TOGGLE_STYLE, right: sidebarOpen ? '300px' : 0 }}
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Hide panel' : 'Show panel'}
        >
          {sidebarOpen ? '▶' : '◀'}
        </div>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className={styles.sidebar}>
          {/* Vehicles */}
          <div className={styles.sectionHead}>
            Vehicles ({vehicles.length})
          </div>
          {vehicles.length === 0 ? (
            <div style={{ padding: '12px 16px' }}>
              <EmptyState icon={<VehicleCarRegular />} title="No vehicles" description="Register vehicles from the Vehicles page." />
            </div>
          ) : (
            vehicles.slice(0, 12).map(v => (
              <div key={v.id} className={styles.vRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>{v.license_plate}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{v.vehicle_type?.replace(/_/g, ' ')}</div>
                </div>
                <VehicleStatusBadge status={v.status} />
              </div>
            ))
          )}

          {/* Incidents */}
          <div className={styles.sectionHead} style={{ marginTop: '8px' }}>
            Active Incidents ({myIncidents.filter(i => i.status !== 'resolved').length})
          </div>
          {myIncidents.filter(i => i.status !== 'resolved').length === 0 ? (
            <div style={{ padding: '12px 16px' }}>
              <EmptyState icon={<AlertUrgentRegular />} title="All clear" description="No active incidents for your station." />
            </div>
          ) : (
            myIncidents
              .filter(i => i.status !== 'resolved')
              .map(inc => {
                const v = vehicles.find(x => x.id === (inc.assigned_unit_id || inc.assigned_vehicle_id));
                const isSelected = selectedIncId === inc.id;
                return (
                  <div
                    key={inc.id}
                    className={styles.incRow}
                    onClick={() => actions.setSelectedIncId(isSelected ? null : inc.id)}
                    style={{ borderLeft: isSelected ? '3px solid var(--color-brand)' : '3px solid transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <Text style={{ fontWeight: 600, fontSize: '13px', flex: 1 }}>{inc.location_name ?? 'Incident'}</Text>
                      <IncidentStatusBadge status={inc.status} />
                    </div>
                    <IncidentTypeChip type={inc.incident_type ?? inc.type_id} />
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Unit: {v ? v.license_plate : (inc.assigned_unit_id ?? 'Unassigned')}
                      {' · '}
                      {new Date(inc.created_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
          )}
        </aside>
      )}
    </div>
  );
}

export default function FleetDashboardPage() {
  return <Suspense><FleetDashboardContent /></Suspense>;
}
