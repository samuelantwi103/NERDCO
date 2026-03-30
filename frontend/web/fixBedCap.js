const fs = require('fs');

const code = `'use client';
import { useState } from 'react';
import { Text, Button, Field, Input, Spinner, makeStyles } from '@fluentui/react-components';
import { HeartPulseRegular, EditRegular, CheckmarkRegular, DismissRegular, AddRegular, SubtractRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { getHospitalsWithCapacity, updateCapacity } from '@/lib/api/auth';
import { PageShell }   from '@/components/ui/PageShell';
import { EmptyState }  from '@/components/ui/EmptyState';

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
    gap: '24px'
  },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: 'var(--shadow-xs)',
    transition: 'box-shadow 150ms ease',
    ':hover': { boxShadow: 'var(--shadow-sm)' },
  },
  cardTitle: { fontWeight: '700', fontSize: '15px' },
  barTrack: { height: '8px', background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 'var(--radius-full)', transition: 'width 400ms ease, background 400ms ease' },
  barMeta:  { fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '5px' },
  editRow:  { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  error:    { color: 'var(--color-fire)', fontSize: '12px' },
  quickActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    background: 'var(--color-bg)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    marginTop: '4px'
  }
});

function capacityColor(pct: number): string {
  if (pct >= 90) return 'var(--color-fire)';
  if (pct >= 70) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function HospitalCard({ hospital, token, onUpdated }: { hospital: any; token: string; onUpdated: () => void }) {
  const styles = useStyles();
  const [editing, setEditing] = useState(false);
  const [avail,   setAvail]   = useState(String(hospital.beds_available ?? 0));
  const [total,   setTotal]   = useState(String(hospital.beds_total ?? 0));
  const [saving,  setSaving]  = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [error,   setError]   = useState('');

  const bedsAvail = hospital.beds_available ?? 0;
  const bedsTotal = hospital.beds_total     ?? 0;
  const occupied  = bedsTotal - bedsAvail;
  const pct       = bedsTotal > 0 ? Math.round((occupied / bedsTotal) * 100) : 0;

  async function save() {
    setError(''); setSaving(true);
    try {
      await updateCapacity(token, hospital.id, parseInt(avail, 10), parseInt(total, 10));
      setEditing(false); onUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Update failed');
    } finally { setSaving(false); }
  }

  async function quickAdjust(delta: number) {
    if (quickSaving || saving) return;
    const newAvail = Math.max(0, Math.min(bedsTotal, bedsAvail + delta));
    if (newAvail === bedsAvail) return; // No change
    
    setQuickSaving(true); setError('');
    try {
      await updateCapacity(token, hospital.id, newAvail, bedsTotal);
      setAvail(String(newAvail));
      onUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Quick update failed');
    } finally {
      setQuickSaving(false);
    }
  }

  function cancel() { setEditing(false); setAvail(String(hospital.beds_available ?? 0)); setTotal(String(hospital.beds_total ?? 0)); setError(''); }

  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <Text className={styles.cardTitle} block>{hospital.name}</Text>
          <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>ID: {hospital.id}</Text>
        </div>
        {!editing && (
          <Button appearance="subtle" icon={<EditRegular />} size="small" onClick={() => setEditing(true)}>
            Edit Config
          </Button>
        )}
      </div>

      <div>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: \`\${pct}%\`, background: capacityColor(pct) }} />
        </div>
        <div className={styles.barMeta}>
          <span>{occupied} occupied · {bedsTotal} total</span>
          <span style={{ color: capacityColor(pct), fontWeight: '600' }}>{bedsAvail} available</span>
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Field label="Available" style={{ minWidth: 0 }}>
              <Input type="number" min={0} value={avail} onChange={e => setAvail(e.target.value)} style={{ width: '100%' }} />
            </Field>
            <Field label="Total Max Capacity" style={{ minWidth: 0 }}>
              <Input type="number" min={0} value={total} onChange={e => setTotal(e.target.value)} style={{ width: '100%' }} />
            </Field>
          </div>
          {error && <Text className={styles.error}>{error}</Text>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button appearance="primary" disabled={saving} icon={saving ? <Spinner size="tiny" /> : <CheckmarkRegular />} 
              style={{ flex: 1, background: 'var(--color-accent)', border: 'none' }} onClick={save}>
              Save Capacity
            </Button>
            <Button appearance="secondary" icon={<DismissRegular />} onClick={cancel} />
          </div>
        </div>
      ) : (
        <div className={styles.quickActions}>
          <Text style={{ fontWeight: '600', fontSize: '12px', flex: 1 }}>Quick actions:</Text>
          <Button 
            appearance="secondary" 
            size="small" 
            icon={<SubtractRegular />} 
            onClick={() => quickAdjust(-1)}
            disabled={quickSaving || bedsAvail <= 0}
            title="-1 Available Bed (Patient Admitted)"
          >
            Admit (-1)
          </Button>
          <Button 
            appearance="secondary" 
            size="small" 
            icon={<AddRegular />} 
            onClick={() => quickAdjust(1)}
            disabled={quickSaving || bedsAvail >= bedsTotal}
            title="+1 Available Bed (Patient Discharged)"
          >
            Discharge (+1)
          </Button>
          {quickSaving && <Spinner size="tiny" />}
          {error && <Text className={styles.error} style={{marginLeft: '8px'}}>{error}</Text>}
        </div>
      )}
    </div>
  );
}

export default function CapacityPage() {
  const { user } = useAuth();
  const token = user?.access_token ?? '';

  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const styles = useStyles();

  async function load() {
    if (!token) return;
    try {
      const data = await getHospitalsWithCapacity(token);
      setHospitals(Array.isArray(data) ? data : data.hospitals ?? []);
    } catch (err: any) {
      console.error("Failed to load capacity", err);
    } finally {
      setLoading(false);
    }
  }

  useAutoRefresh(load, 60_000);

  const visible = user?.role === 'system_admin'
    ? hospitals
    : hospitals.filter(h => h.id === user?.org);

  return (
    <PageShell
      title="Hospital Capacity Management"
      subtitle="Quickly adjust available beds to ensure dispatch routes accurately during emergencies."
      loading={loading}
    >
      {visible.length === 0 ? (
        <EmptyState icon={<HeartPulseRegular />} title="No hospitals" description="No hospital data available." />
      ) : (
        <div className={styles.grid}>
          {visible.map((h: any) => <HospitalCard key={h.id} hospital={h} token={token} onUpdated={load} />)}
        </div>
      )}
    </PageShell>
  );
}
`;
fs.writeFileSync('src/app/(fleet)/fleet/capacity/page.tsx', code);
console.log('Saved bed capacity page');
