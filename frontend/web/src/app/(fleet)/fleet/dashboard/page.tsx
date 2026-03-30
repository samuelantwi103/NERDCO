'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Spinner, makeStyles } from '@fluentui/react-components';
import { ArrowSyncRegular, VehicleCarRegular, AlertUrgentRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { VehicleStatusBadge }  from '@/components/StatusBadge';
import { IncidentStatusBadge } from '@/components/StatusBadge';
import { IncidentTypeChip }    from '@/components/IncidentTypeChip';
import { PageShell }  from '@/components/ui/PageShell';
import { StatCard }   from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFleetDashboard } from './useFleetDashboard';
import { DashboardMap } from '@/app/(ops)/dashboard/DashboardMap';

function getDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const p = 0.017453292519943295;    // Math.PI / 180
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p) / 2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p)) / 2;
  return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

const useStyles = makeStyles({
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  vehicleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '11px 0',
    borderBottom: '1px solid var(--color-border)',
    ':last-child': { borderBottom: 'none' },
  },
  incidentRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 0',
    borderBottom: '1px solid var(--color-border)',
    cursor: 'pointer',
    ':last-child': { borderBottom: 'none' },
  },
  incidentHeader: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  incidentTitle: { fontWeight: '600', fontSize: '14px', flex: 1 },
  altList: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' },
  altBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-bg)',
    cursor: 'pointer', fontSize: '13px',
    ':hover': { borderTopColor: 'var(--color-border-strong)', borderBottomColor: 'var(--color-border-strong)', borderLeftColor: 'var(--color-border-strong)', borderRightColor: 'var(--color-border-strong)' },
  },
  label: { fontSize: '10.5px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' },
});

/* ─── Hospital view ─────────────────────────────────────────────────────── */
function HospitalDashboard({ incidents, vehicles, orgId }: { incidents: any[]; vehicles: any[]; orgId: string | null }) {
  const styles = useStyles();
  // Only show incidents dispatched to THIS hospital (destination_hospital_id match)
  const medical = incidents.filter(
    i => i.incident_type === 'medical' && i.destination_hospital_id === orgId   
  );

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  return (
    <PageShell title="Hospital Dashboard" subtitle="Incoming medical incidents for your hospital">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <StatCard label="Incoming today"  value={medical.length}                                         accentColor="var(--color-medical)" />
        <StatCard label="Open / active"   value={medical.filter(i => i.status !== 'resolved').length}    accentColor="var(--color-warning)" />
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', minHeight: '600px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <SectionCard
            title="Incoming medical incidents"
            actions={<Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Map is interactive</Text>}
          >
            {medical.length === 0 ? (
              <EmptyState icon={<AlertUrgentRegular />} title="No incoming incidents" description="Medical incidents will appear here when dispatched to your hospital." />
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {medical.map((inc, i) => {
                  const vehicle = vehicles.find(v => v.id === inc.assigned_unit_id);
                  return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    style={{
                      padding: '12px',
                      borderBottom: i < medical.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer',
                      backgroundColor: selectedIncidentId === inc.id ? 'var(--color-bg-subtle)' : 'transparent',
                      borderLeft: selectedIncidentId === inc.id ? '3px solid var(--color-accent)' : '3px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Text style={{ fontWeight: '600', fontSize: '14px', flex: 1 }}>{inc.location_name ?? 'Medical incident'}</Text>
                      <IncidentStatusBadge status={inc.status} />
                    </div>
                    {inc.citizen_name && !inc.citizen_name.includes('SceneUnit') && <Text style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Patient: {inc.citizen_name}</Text>}
                    <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Unit: {vehicle ? vehicle.license_plate : (inc.assigned_unit_id ?? 'Unassigned')} · {new Date(inc.created_at).toLocaleTimeString()}
                    </Text>
                  </div>
                )})}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ flex: 1.5, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)', backgroundColor: '#e5e5e5' }}>
          <DashboardMap 
            incidents={medical}
            vehicles={vehicles.filter(v => medical.some(m => m.assigned_unit_id === v.id))}
            selectedId={selectedIncidentId}
            onSelect={setSelectedIncidentId}
            hidePOIs={true}
          />
        </div>
      </div>
    </PageShell>
  );
}

/* ─── Fleet / station view ─────────────────────────────────────────────── */
function FleetDashboardContent() {
  const styles = useStyles();
  const { user } = useAuth();
  const router = useRouter();
  const token = user?.access_token ?? '';

  useEffect(() => {
    if (!user) router.replace('/login');
    else if (user.role !== 'org_admin') router.replace('/dashboard');
  }, [user, router]);

  const { state, actions } = useFleetDashboard(token);
  const { vehicles, incidents, selectedIncId, overriding, loading } = state;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!user || user.role !== 'org_admin') return null;
  const isHospital = user.org_type === 'hospital';
  if (isHospital) return <HospitalDashboard incidents={incidents} vehicles={vehicles} orgId={user.org} />;

  const available   = vehicles.filter(v => v.status === 'available').length;
  const dispatched  = vehicles.filter(v => v.status === 'dispatched').length;
  const unavailable = vehicles.filter(v => v.status === 'unavailable').length;

  const myIncidents = incidents.filter(i =>
    !user?.org || vehicles.some(v => v.id === i.assigned_unit_id)
  );
  const availableVehicles = vehicles.filter(v => v.status === 'available');

  return (
    <PageShell title="Station Dashboard" subtitle="Live status for your station's fleet and active incidents" loading={loading}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard label="Vehicles"         value={vehicles.length}      />
        <StatCard label="Available"        value={available}            accentColor="var(--color-success)" />
        <StatCard label="Dispatched"       value={dispatched}           accentColor="var(--color-warning)" />
        <StatCard label="Unavailable"      value={unavailable}          accentColor="var(--color-fire)" />
        <StatCard label="Active incidents" value={myIncidents.length}   accentColor="var(--color-medical)" />
      </div>

      <div className={styles.grid2}>
        {/* Vehicles */}
        <SectionCard title="Your vehicles">
          {vehicles.length === 0 ? (
            <EmptyState icon={<VehicleCarRegular />} title="No vehicles" description="Add vehicles from the Vehicles page." />
          ) : (
            <div>
              {vehicles.slice(0, 10).map((v, i) => (
                <div key={v.id} className={styles.vehicleRow} style={i === Math.min(vehicles.length, 10) - 1 ? { borderBottom: 'none' } : {}}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text style={{ fontWeight: '600', fontSize: '14px' }}>{v.license_plate}</Text>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'capitalize', marginTop: '2px' }}>
                      {v.vehicle_type?.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <VehicleStatusBadge status={v.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Active incidents */}
        <SectionCard
          title="Active incidents"
          actions={<Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Click to override</Text>}
        >
          {myIncidents.length === 0 ? (
            <EmptyState icon={<AlertUrgentRegular />} title="No active incidents" description="Incidents assigned to your station will appear here." />
          ) : (
            <div>
              {myIncidents.map((inc, i) => {
                const isSelected = selectedIncId === inc.id;
                const assignedV  = vehicles.find(v => v.id === inc.assigned_unit_id);
                  const isWithin20m = inc.created_at ? (Date.now() - new Date(inc.created_at).getTime() <= 1200000) : false;
                return (
                  <div key={inc.id} className={styles.incidentRow} style={i === myIncidents.length - 1 ? { borderBottom: 'none' } : {}}>
                    <div className={styles.incidentHeader} onClick={() => actions.setSelectedIncId(isSelected ? null : inc.id)}>
                      <Text className={styles.incidentTitle}>{inc.location_name ?? 'Incident'}</Text>
                      <IncidentTypeChip type={inc.incident_type} />
                      <IncidentStatusBadge status={inc.status} />
                      <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                        {isSelected ? '▲' : '▼'}
                      </Text>
                    </div>

                    {isSelected && (
                      <div>
                        <span className={styles.label}>
                          Assigned: {assignedV
                            ? `${assignedV.license_plate} (${assignedV.vehicle_type?.replace(/_/g, ' ')})`
                            : inc.assigned_unit_id ?? 'None'}
                        </span>
                        {!isWithin20m ? (
                            <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px', display: 'block' }}>
                              Override window (20mins) has expired.
                          </Text>
                        ) : availableVehicles.length > 0 ? (
                          <>
                            <span className={styles.label} style={{ marginTop: '8px' }}>Override with</span>
                            <div className={styles.altList}>
                              {availableVehicles.map(v => {
                                const dist = getDistanceKM(inc.latitude, inc.longitude, v.latitude, v.longitude);
                                const distText = dist !== null ? `${dist.toFixed(1)} km away` : '—';
                                return (
                                <button
                                  key={v.id}
                                  className={styles.altBtn}
                                  disabled={overriding}
                                  onClick={() => actions.overrideIncident(inc.id, v.id)}
                                >
                                  <ArrowSyncRegular fontSize={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                  <span style={{ flex: 1, textAlign: 'left' }}>
                                    {v.license_plate} — {v.vehicle_type?.replace(/_/g, ' ')}
                                    <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>({distText})</span>
                                  </span>
                                  {overriding && <Spinner size="tiny" />}
                                </button>
                              )})}
                            </div>
                          </>
                        ) : (
                          <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No available vehicles to override with.</Text>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}

export default function FleetDashboardPage() {
  return <Suspense><FleetDashboardContent /></Suspense>;
}
