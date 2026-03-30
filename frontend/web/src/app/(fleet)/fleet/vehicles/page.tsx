'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Text, Button, Field, Input, Select, Spinner,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions,
} from '@fluentui/react-components';
import { AddRegular, VehicleCarRegular, EditRegular, DeleteRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { listVehicles, createVehicle, updateVehicleStatus, updateVehicle, deleteVehicle } from '@/lib/api/tracking';
import { listUsers } from '@/lib/api/auth';
import { POLLING } from '@/lib/config/polling';
import { useToast } from '@/lib/context/ToastContext';
import { vehicleSchema } from '@/lib/schemas';
import { VehicleStatusBadge } from '@/components/StatusBadge';
import dynamic from 'next/dynamic';
import type { PickedLocation } from '@/components/LocationPicker';

const LocationPicker = dynamic(
  () => import('@/components/LocationPicker').then(mod => mod.LocationPicker),
  { ssr: false, loading: () => <p>Loading map...</p> }
);

import { PageShell }  from '@/components/ui/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState }  from '@/components/ui/EmptyState';
import { usePagination } from '@/lib/hooks/usePagination';
import { PaginationBar } from '@/components/ui/PaginationBar';

const VEHICLE_TYPES = ['ambulance', 'fire_truck', 'police_car'];
const ORG_VEHICLE_MAP: Record<string, string[]> = {
  ambulance_service: ['ambulance'],
  police_station:    ['police_car'],
  fire_station:      ['fire_truck'],
};
const STATUSES = ['available', 'dispatched', 'unavailable'];

export default function VehiclesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const token = user?.access_token ?? '';
  const { notifySuccess, notifyError } = useToast();

  const fetcher = async () => {
    const [v, u] = await Promise.all([listVehicles(token), listUsers(token).catch(() => [])]);
    return {
      vehicles: v as any[],
      drivers: (u as any[]).filter((u: any) => u.role === 'first_responder' && u.organization_id === user?.org)
    };
  };

  const { data, isLoading: loading, mutate } = useSWR(token ? ['vehicles-data', token, user?.org] : null, fetcher, {
    refreshInterval: POLLING.FLEET,
  });

  const vehicles = data?.vehicles ?? [];
  const drivers = data?.drivers ?? [];

  const [open,     setOpen]     = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const allowedTypes = ORG_VEHICLE_MAP[user?.org_type ?? ''] ?? VEHICLE_TYPES;
  const defaultType  = allowedTypes[0] ?? 'ambulance';
  const [form, setForm] = useState({ license_plate: '', vehicle_type: '', driver_user_id: '' });
  const [location, setLocation] = useState<PickedLocation | null>(null);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'org_admin') router.replace('/dashboard');
  }, [user, router]);

  function openEdit(v: any) {
    const vehicleType = allowedTypes.includes(v.vehicle_type) ? v.vehicle_type : defaultType;
    setEditId(v.id);
    setForm({
      license_plate:  v.license_plate,
      vehicle_type:   vehicleType,
      driver_user_id: v.driver_user_id || '',
    });
    if (v.latitude && v.longitude) setLocation({ lat: v.latitude, lng: v.longitude, name: '' });
    else setLocation(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setEditId(null);
    setForm({ license_plate: '', vehicle_type: '', driver_user_id: '' });
    setLocation(null);
    setError('');
  }

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCreateOrUpdate(e: FormEvent) {
    e.preventDefault();
    if (!user?.org) { setError('Your account is not linked to an organisation.'); return; }
    
    const parsed = vehicleSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    
    setError(''); setSaving(true);
    try {
      if (editId) {
        await updateVehicle(token, editId, {
          license_plate:     form.license_plate,
          vehicle_type:      form.vehicle_type || defaultType,
          organization_id:   user.org,
          organization_type: user.org_type ?? '',
          driver_user_id:    form.driver_user_id || undefined,
        });
      } else {
        await createVehicle(token, {
          license_plate:     form.license_plate,
          vehicle_type:      form.vehicle_type || defaultType,
          organization_id:   user.org,
          organization_type: user.org_type ?? '',
          driver_user_id:    form.driver_user_id || undefined,
          latitude:          location?.lat,
          longitude:         location?.lng,
        });
      }
      handleClose();
      notifySuccess('Success', editId ? 'Vehicle updated successfully' : 'Vehicle created successfully');
      mutate();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save vehicle';
      setError(msg);
      notifyError('Error', msg);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deleteVehicle(token, deleteId);
      setDeleteId(null);
      notifySuccess('Deleted', 'Vehicle removed from fleet');
      mutate();
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.message ?? 'Failed to delete vehicle');
    } finally { setSaving(false); }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateVehicleStatus(token, id, status);
      notifySuccess('Updated', 'Vehicle status updated');
      mutate();
    } catch (err: any) {
      notifyError('Error', 'Failed to update status');
    }
  }

  const columns: Column<any>[] = [
    {
      key: 'plate', label: 'Plate',
      render: v => <span style={{ fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{v.license_plate}</span>,
    },
    {
      key: 'type', label: 'Type',
      render: v => <span style={{ textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>{v.vehicle_type?.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'driver', label: 'Driver',
      render: v => {
        const d = drivers.find(d => d.id === v.driver_user_id);
        return d ? <span>{d.name}</span> : <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>;
      },
    },
    { key: 'status', label: 'Status', render: v => <VehicleStatusBadge status={v.status} /> },
    {
      key: 'updated', label: 'Last seen', width: '130px',
      render: v => <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
        {v.last_updated ? new Date(v.last_updated).toLocaleTimeString() : '—'}
      </span>,
    },
    {
      key: 'actions', label: '', width: '160px',
      render: v => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <select
            value={v.status}
            onChange={e => handleStatusChange(v.id, e.target.value)}
            style={{ fontSize: '13px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', background: 'var(--color-surface)', cursor: 'pointer' }}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button appearance="transparent" icon={<EditRegular fontSize={16} />} onClick={() => openEdit(v)} title="Edit vehicle" />
          <Button appearance="transparent" icon={<DeleteRegular fontSize={16} />} onClick={() => setDeleteId(v.id)} style={{ color: 'var(--color-fire)' }} title="Delete vehicle" />
        </div>
      ),
    },
  ];

  const { slice: vehicleSlice, page: vehiclePage, total: vehicleTotal, setPage: setVehiclePage } = usePagination(vehicles);

  if (!user || user.role !== 'org_admin') return null;

  return (
    <PageShell
      title="Vehicles"
      subtitle={`${vehicles.length} registered vehicle${vehicles.length !== 1 ? 's' : ''}`}
      loading={loading}
      actions={
          <Button appearance="primary" icon={<AddRegular />} style={{ background: 'var(--color-accent)', border: 'none' }} onClick={() => { handleClose(); setOpen(true); }}>
          Add vehicle
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={vehicleSlice}
        rowKey={v => v.id}
        emptyTitle="No vehicles yet"
        emptyDescription="Add your first vehicle to start tracking your fleet."
      />
      <PaginationBar page={vehiclePage} total={vehicleTotal} onChange={setVehiclePage} />

      <Dialog open={open} onOpenChange={(_, d) => !d.open && handleClose()}>
        <DialogSurface style={{ maxWidth: '420px' }}>
          <form onSubmit={handleCreateOrUpdate}>
            <DialogTitle>{editId ? 'Edit vehicle' : 'Add vehicle'}</DialogTitle>
            <DialogBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px', marginTop: '12px' }}>
                <Field label="Plate / licence number" required>
                  <Input value={form.license_plate} onChange={e => setField('license_plate', e.target.value)} placeholder="e.g. GA-546-21" required autoFocus />
                </Field>
                <Field label="Type" required>
                  <Select value={form.vehicle_type || defaultType} onChange={e => setField('vehicle_type', e.target.value)}>
                    {allowedTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </Select>
                </Field>
                <Field label="Assign driver">
                  <Select value={form.driver_user_id} onChange={e => setField('driver_user_id', e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </Field>                  {!editId && (
                    <Field label="Initial Location">
                      <LocationPicker value={location} onChange={setLocation} height="200px" />
                    </Field>
                  )}                {error && <Text style={{ color: 'var(--color-fire)', fontSize: '13px' }}>{error}</Text>}
              </div>
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={handleClose}>Cancel</Button>
              <Button type="submit" appearance="primary" disabled={saving} style={{ background: 'var(--color-accent)', border: 'none' }}>
                {saving ? <Spinner size="tiny" /> : 'Save'}
              </Button>
            </DialogActions>
          </form>
        </DialogSurface>
      </Dialog>
      
      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(_, d) => !d.open && setDeleteId(null)}>
        <DialogSurface>
          <DialogTitle>Confirm deletion</DialogTitle>
          <DialogBody>
            Are you sure you want to delete this vehicle? Actions cannot be undone.
          </DialogBody>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setDeleteId(null)} disabled={saving}>Cancel</Button>
            <Button appearance="primary" onClick={handleDelete} disabled={saving} style={{ background: 'var(--color-fire)', color: 'white' }}>
              {saving ? <Spinner size="tiny" /> : 'Delete vehicle'}
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </PageShell>
  );
}
