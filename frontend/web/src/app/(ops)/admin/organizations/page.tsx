'use client';
import { useState, FormEvent, useEffect, useRef } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { useRouter } from 'next/navigation';
import {
  Text, Button, Field, Input, Select, Spinner, Divider,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions,
  makeStyles,
  ToggleButton,
} from '@fluentui/react-components';
import { AddRegular, BuildingMultipleRegular, HeartPulseRegular, VehicleCarRegular, ShieldRegular, EditRegular, DeleteRegular, MapRegular, ListRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useShowToast } from '@/lib/context/ToastContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { listOrganizations, createOrganization, updateOrganization, deleteOrganization } from '@/lib/api/auth';
import { POLLING } from '@/lib/config/polling';
import { LocationPicker, type PickedLocation } from '@/components/LocationPicker';
import { PageShell } from '@/components/ui/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadGoogleMaps } from '@/lib/maps/loader';
import { usePagination } from '@/lib/hooks/usePagination';
import { PaginationBar } from '@/components/ui/PaginationBar';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' },
  card: {
    position: 'relative',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: 'var(--shadow-xs)',
    transition: 'box-shadow 150ms ease',
    ':hover': { boxShadow: 'var(--shadow-sm)' },
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' },
  cardName: { fontWeight: '600', fontSize: '14px', lineHeight: '1.3', paddingRight: '40px' },
  cardMeta: { fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: '1.4' },
  cardActions: { position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '4px' },
  actionBtn: { width: '24px', height: '24px', minWidth: '24px', padding: 0 },
  typePill: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: '10.5px',
    fontWeight: '600',
    flexShrink: 0,
    marginTop: '4px',
    alignSelf: 'flex-start',
  },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: '10px',
    paddingBottom: '8px',
    borderBottom: '2px solid var(--color-border)',
  },
  groupTitle: { fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px' },
  groupCount: { fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' },
  error: { fontSize: '13px', color: 'var(--color-fire)' },
  mapContainer: { width: '100%', height: 'calc(100vh - 180px)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' },
});

const ORG_TYPES = ['ambulance_service', 'hospital', 'police_station', 'fire_station'] as const;
type OrgType = typeof ORG_TYPES[number];

const TYPE_META: Record<OrgType, { label: string; groupLabel: string; color: string; bg: string; Icon: React.FC<any> }> = {
  ambulance_service: { label: 'Ambulance',    groupLabel: 'Ambulance Services',  color: '#1D4ED8', bg: '#EFF6FF', Icon: VehicleCarRegular        },
  hospital:          { label: 'Hospital',     groupLabel: 'Hospitals',           color: '#15803D', bg: '#F0FDF4', Icon: HeartPulseRegular        },
  police_station:    { label: 'Police',       groupLabel: 'Police Stations',     color: '#6D28D9', bg: '#F5F3FF', Icon: ShieldRegular            },
  fire_station:      { label: 'Fire',         groupLabel: 'Fire Stations',       color: '#B91C1C', bg: '#FEF2F2', Icon: BuildingMultipleRegular  },
};

function OrgCard({ org, onEdit, onDelete }: { org: any, onEdit: () => void, onDelete: () => void }) {
  const styles = useStyles();
  const meta = TYPE_META[org.type as OrgType];
  return (
    <div className={styles.card}>
      <div className={styles.cardActions}>
        <Button appearance="transparent" className={styles.actionBtn} icon={<EditRegular fontSize={14} />} onClick={onEdit} title="Edit" />
        <Button appearance="transparent" className={styles.actionBtn} icon={<DeleteRegular fontSize={14} />} onClick={onDelete} title="Delete" style={{color: 'var(--color-fire)'}} />
      </div>
      <div className={styles.cardTop}>
        <Text className={styles.cardName}>{org.name}</Text>
      </div>
      {meta && (
        <span className={styles.typePill} style={{ background: meta.bg, color: meta.color }}>
          <meta.Icon fontSize={11} />
          {meta.label}
        </span>
      )}
      <div style={{ marginTop: '4px' }}>
        {org.address && <Text className={styles.cardMeta} block>{org.address}</Text>}
        {org.phone   && <Text className={styles.cardMeta} block>{org.phone}</Text>}
        {org.type === 'hospital' && org.beds_total != null && (
          <Text className={styles.cardMeta} block style={{ color: org.beds_available === 0 ? 'var(--color-fire)' : 'var(--color-text-muted)' }}>
            {org.beds_available ?? '?'} / {org.beds_total} beds available
          </Text>
        )}
        <Text className={styles.cardMeta} block style={{ fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
          {parseFloat(org.latitude).toFixed(5)}, {parseFloat(org.longitude).toFixed(5)}
        </Text>
      </div>
    </div>
  );
}

function PaginatedOrgGrid({ items, onEdit, onDelete }: { items: any[]; onEdit: (o: any) => void; onDelete: (id: string) => void }) {
  const { slice, page, total, setPage } = usePagination(items);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' }}>
        {slice.map(o => <OrgCard key={o.id} org={o} onEdit={() => onEdit(o)} onDelete={() => onDelete(o.id)} />)}
      </div>
      <PaginationBar page={page} total={total} onChange={setPage} />
    </>
  );
}

export default function OrganizationsPage() {
  const styles = useStyles();
  const { user } = useAuth();
  const router = useRouter();
  const token = user?.access_token ?? '';
  const showToast = useShowToast();

  // Only system_admin may manage organisations
  useEffect(() => {
    if (user && user.role !== 'system_admin') router.replace('/dashboard');
  }, [user, router]);
  if (!user || user.role !== 'system_admin') return null;

  const [orgs,     setOrgs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  
  // Modals
  const [open,     setOpen]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  
  // Form State
  const [editId,    setEditId]    = useState<string | null>(null);
  const [formType,  setFormType]  = useState<OrgType>('ambulance_service');
  const [formName,  setFormName]  = useState('');
  const [formAddr,  setFormAddr]  = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formBeds,  setFormBeds]  = useState('');
  const [formLoc,   setFormLoc]   = useState<PickedLocation | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'list'|'map'>('list');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const loadOrgs = async () => {
    try { 
      setPageError(null);
      setOrgs(await listOrganizations(token)); 
    } catch (err: any) {
      setPageError(err.message || 'Failed to load organizations');
    } finally { setLoading(false); }
  };
  useAutoRefresh(loadOrgs, POLLING.ADMIN);

  // Map initialization
  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current || !MAPS_KEY) return;
    let active = true;

    loadGoogleMaps(MAPS_KEY).then(() => {
      if (!active || !window.google) return;
      if (!mapObj.current) {
        mapObj.current = new window.google.maps.Map(mapRef.current!, {
          center: { lat: 5.6037, lng: -0.1870 }, // Default to Accra roughly
          zoom: 12,
          mapId: 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: true,
        });
      }
      
      // Clear old markers
      markersRef.current.forEach(m => m.map = null);
      markersRef.current = [];

      // Add new markers
      orgs.forEach(org => {
        if (org.latitude && org.longitude) {
          const m = new window.google.maps.marker.AdvancedMarkerElement({       
            map: mapObj.current!,
            position: { lat: parseFloat(org.latitude), lng: parseFloat(org.longitude) },
            title: org.name,
            content: makeFacilityPin(org.type, org.name, false),
      });
      
      // Auto-fit bounds
      if (orgs.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        orgs.forEach(o => bounds.extend({ lat: parseFloat(o.latitude), lng: parseFloat(o.longitude) }));
        mapObj.current.fitBounds(bounds);
      }
    });

    return () => { active = false; };
  }, [viewMode, orgs]);

  function resetForm() {
    setEditId(null); setFormType('ambulance_service'); setFormName(''); setFormAddr('');
    setFormPhone(''); setFormBeds(''); setFormLoc(null); setError('');
  }

  function handleEdit(org: any) {
    setEditId(org.id);
    setFormType(org.type);
    setFormName(org.name);
    setFormAddr(org.address || '');
    setFormPhone(org.phone || '');
    setFormBeds(org.beds_total ? String(org.beds_total) : '');
    setFormLoc({ lat: parseFloat(org.latitude), lng: parseFloat(org.longitude), name: `${org.latitude}, ${org.longitude}` });
    setOpen(true);
  }

  async function handleCreateOrUpdate(e: FormEvent) {
    e.preventDefault();
    if (!formLoc) { setError('Drop a pin on the map to set the location.'); return; }
    setError(''); setSaving(true);
    try {
      const payload = {
        name: formName, type: formType,
        latitude: formLoc.lat, longitude: formLoc.lng,
        address: formAddr || undefined,
        phone:   formPhone || undefined,
        beds_total:     formType === 'hospital' && formBeds ? parseInt(formBeds, 10) : undefined,
        beds_available: formType === 'hospital' && formBeds ? parseInt(formBeds, 10) : undefined,
      };
      if (editId) {
        await updateOrganization(token, editId, payload);
        showToast('Organization updated');
      } else {
        await createOrganization(token, payload);
      }
      setOpen(false); resetForm();
      setOrgs(await listOrganizations(token));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save organisation');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deleteOrganization(token, deleteId);
      setDeleteId(null);
      setOrgs(await listOrganizations(token));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to delete organisation');
    } finally { setSaving(false); }
  }

  const grouped = ORG_TYPES.reduce<Record<string, any[]>>((acc, t) => {
    acc[t] = orgs.filter(o => o.type === t);
    return acc;
  }, {} as any);

  return (
    <PageShell
      title="Organisations"
      subtitle={`${orgs.length} registered organisation${orgs.length !== 1 ? 's' : ''}`}
      loading={loading}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <Button appearance={viewMode === 'list' ? 'primary' : 'transparent'} icon={<ListRegular />} onClick={() => setViewMode('list')} style={{ borderRadius: 0, minWidth: '40px' }} />
              <Button appearance={viewMode === 'map' ? 'primary' : 'transparent'} icon={<MapRegular />} onClick={() => setViewMode('map')} style={{ borderRadius: 0, minWidth: '40px' }} />
          </div>
          <Button appearance="primary" icon={<AddRegular />} style={{ background: 'var(--color-accent)', border: 'none' }}
            onClick={() => { resetForm(); setOpen(true); }}>
            Register organisation
          </Button>
        </div>
      }
    >
      {pageError ? (
        <ErrorState message={pageError} onRetry={loadOrgs} />
      ) : viewMode === 'map' ? (
        <div ref={mapRef} className={styles.mapContainer} />
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={<BuildingMultipleRegular />}
          title="No organisations yet"
          description="Register ambulance services, hospitals, police stations and fire stations to start dispatching."
        />
      ) : (
        ORG_TYPES.map(type => {
          const items = grouped[type];
          if (!items.length) return null;
          const meta = TYPE_META[type];
          return (
            <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div className={styles.groupHeader}>
                <meta.Icon fontSize={14} style={{ color: meta.color }} />
                <Text className={styles.groupTitle} style={{ color: meta.color }}>{meta.groupLabel}</Text>
                <span className={styles.groupCount}>{items.length}</span>
              </div>
              <PaginatedOrgGrid items={items} onEdit={handleEdit} onDelete={setDeleteId} />
            </div>
          );
        })
      )}

      {/* Editor Modal */}
      <Dialog open={open} onOpenChange={(_, d) => { setOpen(d.open); if (!d.open) resetForm(); }}>
        <DialogSurface style={{ maxWidth: '640px', width: '95vw' }}>
          <form onSubmit={handleCreateOrUpdate}>
            <DialogTitle>{editId ? 'Edit organisation' : 'Register organisation'}</DialogTitle>
            <DialogBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field label="Name" required style={{ gridColumn: '1 / -1' }}>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} required placeholder="e.g. Korle Bu Teaching Hospital" />
                  </Field>
                  <Field label="Type" required>
                    <Select value={formType} onChange={e => setFormType(e.target.value as OrgType)} disabled={!!editId}>
                      {ORG_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </Select>
                  </Field>
                  {formType === 'hospital' && (
                    <Field label="Total beds" hint="To update available beds safely, use the Fleet Capacity tool">
                      <Input type="number" min="0" value={formBeds} onChange={e => setFormBeds(e.target.value)} placeholder="e.g. 400" disabled={!!editId} />
                    </Field>
                  )}
                  <Field label="Address" style={{ gridColumn: '1 / -1' }}>
                    <Input value={formAddr} onChange={e => setFormAddr(e.target.value)} placeholder="Street address" />
                  </Field>
                  <Field label="Phone">
                    <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+233 …" />
                  </Field>
                </div>
                <Divider />
                <div>
                  <Text style={{ fontWeight: '600', fontSize: '13px', marginBottom: '6px', display: 'block' }}>Location</Text>
                  {formLoc && (
                    <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px', display: 'block' }}>
                      {formLoc.name} ({formLoc.lat.toFixed(5)}, {formLoc.lng.toFixed(5)})
                    </Text>
                  )}
                  <LocationPicker value={formLoc} onChange={setFormLoc} height="240px" />
                </div>
                {error && <Text className={styles.error}>{error}</Text>}
              </div>
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" appearance="primary" disabled={saving} style={{ background: 'var(--color-accent)', border: 'none' }}>
                {saving ? <Spinner size="tiny" /> : 'Save'}
              </Button>
            </DialogActions>
          </form>
        </DialogSurface>
      </Dialog>
      
      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(_, d) => { if (!d.open) setDeleteId(null); }}>
        <DialogSurface>
          <DialogTitle>Confirm deletion</DialogTitle>
          <DialogBody>
            Are you sure you want to delete this organisation? It may break references to users or vehicles assigned to it.
          </DialogBody>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setDeleteId(null)} disabled={saving}>Cancel</Button>
            <Button appearance="primary" onClick={handleDelete} disabled={saving} style={{ background: 'var(--color-fire)', color: 'white' }}>
              {saving ? <Spinner size="tiny" /> : 'Delete'}
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </PageShell>
  );
}
