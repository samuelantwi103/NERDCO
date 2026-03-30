'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Button, Spinner, makeStyles } from '@fluentui/react-components';
import { SignOutRegular, AlertUrgentRegular, PersonRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { POLLING } from '@/lib/config/polling';
import { listOpenIncidents } from '@/lib/api/incidents';
import { listVehicles } from '@/lib/api/tracking';
import { IncidentTypeChip }    from '@/components/IncidentTypeChip';
import { IncidentStatusBadge } from '@/components/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { DashboardMap } from '@/app/(ops)/dashboard/DashboardMap';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative'
  },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)'
  },
  brand: { fontWeight: '700', fontSize: '16px' },
  userName: { fontSize: '13px', color: 'var(--color-text-muted)' },
  bottomSheet: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      zIndex: 10,
      background: 'var(--color-surface)',
      borderTopLeftRadius: '20px',
      borderTopRightRadius: '20px',
      maxWidth: '500px', margin: '0 auto',
      padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    cursor: 'pointer',
  },
  incidentCard: { background: 'var(--color-surface-variant)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  cardTitle: { fontWeight: '700', fontSize: '16px' },
  cardMeta: { fontSize: '13px', color: 'var(--color-text-muted)' },
  empty: { color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px 0' },
  assignedBanner: {
    background: '#000',
    color: '#fff',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bannerTitle: { fontWeight: '700', fontSize: '15px', color: '#fff' },
  bannerMeta:  { fontSize: '13px', color: 'rgba(255,255,255,0.65)' },
  goBtn: {
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontWeight: '700',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '6px',
  },
});

export default function FieldPage() {
  const styles = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();
  const token = user?.access_token ?? '';

  const [incidents, setIncidents] = useState<any[]>([]);
  const [myVehicleId, setMyVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    setMounted(true);
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log('Location error:', err),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'first_responder') router.replace('/dashboard');
  }, [user, router]);

  const load = async () => {
    try {
      const [data, vehicles] = await Promise.all([
        listOpenIncidents(token),
        listVehicles(token).catch(() => [] as any[]),
      ]);
      setIncidents(data);
      // Find the vehicle assigned to this user
      const mine = (vehicles as any[]).find((v: any) => v.driver_user_id === user?.id);
      setMyVehicleId(mine?.id ?? null);
      setError(null);
    } catch {
      setError('Failed to fetch open incidents');
    } finally {
      setLoading(false);
    }
  };

  useAutoRefresh(load, POLLING.FIELD);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  // Find the incident assigned to this user's vehicle specifically
  const myIncident = incidents.find(i =>
    (i.status === 'dispatched' || i.status === 'in_progress') &&
    myVehicleId && (i.assigned_vehicle_id === myVehicleId || i.assigned_unit_id === myVehicleId)
  ) ?? incidents.find(i =>
    // Fallback: any active incident if vehicle assignment not determined yet
    (i.status === 'dispatched' || i.status === 'in_progress') && !myVehicleId
  ) ?? null;

  const queuedIncidents = incidents.filter(i => i.status === 'created');

  if (!mounted) return null;
  if (!user || user.role !== 'first_responder') return null;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div>
          <Text className={styles.brand}>NERDCO Field</Text>
          <Text as="p" className={styles.userName}>{user?.name}</Text>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button appearance="transparent" icon={<PersonRegular />} onClick={() => router.push("/field/profile")} aria-label="Profile" />
          <Button appearance="transparent" icon={<SignOutRegular />} onClick={handleLogout} aria-label="Sign out" />
        </div>
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        <DashboardMap 
          incidents={incidents} 
          vehicles={[]} 
          selectedId={myIncident?.parent_incident_id || myIncident?.id || null} 
          onSelect={() => {}} 
          myLocation={myLocation}
          hidePOIs={true}
        />
      </div>
      <div className={styles.bottomSheet}>
        {loading && incidents.length === 0 ? (
          <Spinner size="small" />
        ) : error ? (
          <ErrorState message={error} />
        ) : myIncident ? (
          <div className={styles.assignedBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertUrgentRegular style={{ fontSize: '20px', color: 'var(--color-fire)' }} />
              <Text className={styles.bannerTitle}>Active Assignment</Text>
            </div>
            <Text className={styles.bannerTitle}>{myIncident.type_id}</Text>
            <Text className={styles.bannerMeta}>{myIncident.location_name}</Text>
            <button className={styles.goBtn} onClick={() => router.push(`/field/incident?id=${myIncident.id}`)}>
              View Details
            </button>
          </div>
        ) : (
          <>
            <Text style={{ fontWeight: '600', fontSize: '15px' }}>Incoming Feed ({queuedIncidents.length})</Text>
            {queuedIncidents.length === 0 ? (
              <EmptyState title="No active incidents" description="You have no assignments. Stand by." />
            ) : (
              queuedIncidents.map(inc => (
                <div key={inc.id} className={styles.incidentCard} onClick={() => router.push(`/field/incident?id=${inc.id}`)}>
                  <div className={styles.cardHeader}>
                    <IncidentTypeChip type={inc.type_id} />
                    <IncidentStatusBadge status={inc.status} />
                  </div>
                  <Text className={styles.cardTitle}>{inc.location_name}</Text>
                  <Text className={styles.cardMeta}>Reported {new Date(inc.created_at).toLocaleTimeString()}</Text>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
