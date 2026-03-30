import { useState, useEffect } from 'react';
import { Text, Spinner, makeStyles, Select, Button } from '@fluentui/react-components';
import { VehicleStatusBadge } from '@/components/StatusBadge';
import { listUsers } from '@/lib/api/auth';
import { updateVehicle } from '@/lib/api/tracking';
import { useAuth } from '@/lib/context/AuthContext';

const STATUS_COLOR: Record<string, string> = {
  available:   '#107C10',
  dispatched:  '#FF8C00',
  unavailable: '#D13438',
};

const useStyles = makeStyles({
  sidebar: {
    width: '320px',
    minWidth: '320px',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarTitle: { fontWeight: '700', fontSize: '15px' },
  sidebarList: { flex: 1, overflowY: 'auto' },
  vehicleItem: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    cursor: 'pointer',
    ':hover': { background: 'var(--color-bg)' },
  },
  vehicleItemActive: { background: 'var(--color-bg)', borderLeft: '3px solid var(--gray-950)' },
  vehicleName: { fontWeight: '600', fontSize: '14px', marginBottom: '2px' },
  vehicleMeta: { fontSize: '12px', color: 'var(--color-text-muted)' },
  driverBlock: {
    marginTop: '6px',
    padding: '8px',
    background: 'white',
    borderRadius: '4px',
    border: '1px solid var(--color-border)'
  },
  driverLabel: { fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '4px', display: 'block' }
});

interface VehicleSidebarProps {
  vehicles: any[];
  loading: boolean;
  selected: string | null;
  onVehicleClick: (v: any) => void;
  onVehicleUpdated: () => void;
}

export function VehicleSidebar({ vehicles, loading, selected, onVehicleClick, onVehicleUpdated }: VehicleSidebarProps) {
  const styles = useStyles();
  const { user } = useAuth();
  const token = user?.access_token ?? '';

  const [responders, setResponders] = useState<any[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!token || user?.role !== 'org_admin') return;
    listUsers(token).then(all => {
      const available = all.filter(u => u.organization_id === user.org && (u.role === 'first_responder' || u.role === 'org_admin'));
      setResponders(available);
    }).catch(console.error);
  }, [token, user]);

  const counts = {
    available:  vehicles.filter(v => v.status === 'available').length,
    dispatched: vehicles.filter(v => v.status === 'dispatched').length,
  };

  async function handleAssignDriver(vehicleId: string, driverId: string) {
    if (!token) return;
    setUpdating(vehicleId);
    try {
      await updateVehicle(token, vehicleId, { driver_user_id: driverId || null });
      if(onVehicleUpdated) onVehicleUpdated();
    } catch (err: any) {
      console.error('Failed to assign driver', err);
      alert(err?.response?.data?.message || 'Failed to assign driver.');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <Text className={styles.sidebarTitle}>
          {loading ? 'Loading…' : `Vehicles (${vehicles.length})`}
        </Text>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: STATUS_COLOR.available, fontWeight: '600' }}>{counts.available} avail</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>·</span>
          <span style={{ fontSize: '11px', color: STATUS_COLOR.dispatched, fontWeight: '600' }}>{counts.dispatched} disp</span>
        </div>
      </div>

      <div className={styles.sidebarList}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <Spinner size="small" />
          </div>
        ) : vehicles.length === 0 ? (
          <Text style={{ padding: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            No vehicles registered.
          </Text>
        ) : (
          vehicles.map(v => (
            <div
              key={v.id}
              className={`${styles.vehicleItem} ${selected === v.id ? styles.vehicleItemActive : ''}`}
              onClick={() => onVehicleClick(v)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text className={styles.vehicleName} block>{v.license_plate}</Text>
                  <Text className={styles.vehicleMeta} block>
                    {v.vehicle_type?.replace(/_/g, ' ')}
                    {v.organization_name ? ` · ${v.organization_name}` : ''}
                  </Text>
                </div>
                <VehicleStatusBadge status={v.status} />
              </div>
              
              {!v.latitude && (
                <Text style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>No location yet</Text>
              )}

              {selected === v.id && user?.role === 'org_admin' && (
                <div 
                  className={styles.driverBlock} 
                  onClick={e => e.stopPropagation()} 
                >
                  <Text className={styles.driverLabel}>ASSIGN DRIVER</Text>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Select 
                      size="small" 
                      style={{ flex: 1 }} 
                      value={v.driver_user_id || ''} 
                      onChange={e => handleAssignDriver(v.id, e.target.value)}
                      disabled={updating === v.id}
                    >
                      <option value="">— Unassigned —</option>
                      {responders.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                      ))}
                    </Select>
                    {updating === v.id && <Spinner size="tiny" />}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
