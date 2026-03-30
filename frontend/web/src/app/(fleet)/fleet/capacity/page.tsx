'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Text, Button, Field, Input, Spinner, makeStyles } from '@fluentui/react-components';
import { HeartPulseRegular, EditRegular, CheckmarkRegular, DismissRegular, AddRegular, SubtractRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useShowToast } from '@/lib/context/ToastContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { getHospitalsWithCapacity, updateCapacity } from '@/lib/api/auth';
import { POLLING } from '@/lib/config/polling';
import { PageShell }   from '@/components/ui/PageShell';
import { EmptyState }  from '@/components/ui/EmptyState';
import { ErrorState }  from '@/components/ui/ErrorState';

const useStyles = makeStyles({
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-xs)',
  },
  cardHeader: {
    padding: '16px 20px',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  cardTitle: { fontWeight: '600', fontSize: '18px', letterSpacing: '0' },
  statusSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  barTrack: { height: '24px', background: 'var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 'var(--radius-md)', transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1), background 400ms ease' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    marginTop: '8px'
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  statLabel: { fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontSize: '20px', fontWeight: '600' },
  
  controlSection: {
    padding: '24px',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  actionButton: {
    height: '42px',
    fontSize: '16px',
    fontWeight: '700'
  },
  editRow:  { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  error:    { color: 'var(--color-fire)', fontSize: '13px', fontWeight: '600' }
});

function capacityColor(pct: number): string {
  if (pct >= 90) return 'var(--color-fire)';
  if (pct >= 75) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function HospitalManager({ hospital, token, onUpdated }: { hospital: any; token: string; onUpdated: () => void }) {
  const styles = useStyles();
  const showToast = useShowToast();
  const [editing, setEditing] = useState(false);
  const [avail,   setAvail]   = useState(String(hospital.beds_available ?? 0));
  const [total,   setTotal]   = useState(String(hospital.beds_total ?? 0));
  const [saving,  setSaving]  = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [error,   setError]   = useState('');

  const bedsAvail = hospital.beds_available ?? 0;
  const bedsTotal = hospital.beds_total     ?? 0;
  const occupied  = bedsTotal - bedsAvail;
  const pct       = bedsTotal > 0 ? Math.round((bedsTotal - bedsAvail) / bedsTotal * 100) : 0;

  const availNum   = parseInt(avail, 10);
  const totalNum   = parseInt(total, 10);
  const availError = !isNaN(availNum) && !isNaN(totalNum) && (availNum < 0 || availNum > totalNum)
    ? `Must be between 0 and ${totalNum}`
    : '';

  async function save() {
    setError(''); setSaving(true);
    try {
      await updateCapacity(token, hospital.id, parseInt(avail, 10), parseInt(total, 10));
      showToast('Configuration updated');
      setEditing(false); onUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Update failed');
    } finally { setSaving(false); }
  }

  async function quickAdjust(delta: number) {
    if (quickSaving || saving) return;
    const newAvail = Math.max(0, Math.min(bedsTotal, bedsAvail + delta));
    if (newAvail === bedsAvail) return; 
    
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
      <div className={styles.cardHeader}>
        <div>
          <Text className={styles.cardTitle} block>{hospital.name}</Text>
          <Text style={{ color: 'var(--color-text-muted)', fontWeight: '500' }}>{hospital.address ?? 'Hospital Facility'}</Text>
        </div>
        <Button 
          appearance="subtle" 
          icon={editing ? <DismissRegular /> : <EditRegular />} 
          onClick={() => editing ? cancel() : setEditing(true)}
        >
          {editing ? 'Cancel' : 'Edit Base Config'}
        </Button>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.statusSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
            <Text style={{ fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Occupancy Level</Text>
            <Text style={{ fontWeight: '600', fontSize: '18px', color: capacityColor(pct) }}>{pct}%</Text>
          </div>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${pct}%`, background: capacityColor(pct) }} />
          </div>
          
          <div className={styles.statsRow}>
            <div className={styles.statBlock}>
              <Text className={styles.statLabel}>Available</Text>
              <Text className={styles.statValue} style={{ color: 'var(--color-success)' }}>{bedsAvail}</Text>
            </div>
            <div className={styles.statBlock}>
              <Text className={styles.statLabel}>Occupied</Text>
              <Text className={styles.statValue}>{occupied}</Text>
            </div>
            <div className={styles.statBlock}>
              <Text className={styles.statLabel}>Total Beds</Text>
              <Text className={styles.statValue}>{bedsTotal}</Text>
            </div>
          </div>
        </div>

        <div className={styles.controlSection}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Text style={{ fontWeight: '700', fontSize: '16px' }}>Adjust Facility Configuration</Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="Beds Currently Available">
                  <Input type="number" min={0} max={hospital.beds_total} value={avail} onChange={e => setAvail(e.target.value)} size="large" />
                  {availError && <Text className={styles.error}>{availError}</Text>}
                </Field>
                <Field label="Total Maximum Beds">
                  <Input type="number" min={0} value={total} onChange={e => setTotal(e.target.value)} size="large" />
                </Field>
              </div>
              {error && <Text className={styles.error}>{error}</Text>}
              <Button appearance="primary" disabled={saving || !!availError} icon={saving ? <Spinner size="tiny" /> : <CheckmarkRegular />}
                style={{ height: '48px', background: 'var(--color-accent)', fontWeight: '700' }} onClick={save}>
                Update Configuration
              </Button>
            </div>
          ) : (
            <>
              <Text style={{ fontWeight: '700', fontSize: '16px' }}>Real-time Adjustments</Text>
              <div className={styles.quickActions}>
                <Button 
                  appearance="primary" 
                  className={styles.actionButton}
                  icon={<SubtractRegular fontSize={24} />} 
                  onClick={() => quickAdjust(-1)}
                  disabled={quickSaving || bedsAvail <= 0}
                >
                  Admit Patient (-1)
                </Button>
                <Button 
                  appearance="outline" 
                  className={styles.actionButton}
                  icon={<AddRegular fontSize={24} />} 
                  onClick={() => quickAdjust(1)}
                  disabled={quickSaving || bedsAvail >= bedsTotal}
                >
                  Discharge Patient (+1)
                </Button>
              </div>
              {quickSaving && <div style={{ display: 'flex', justifyContent: 'center' }}><Spinner label="Syncing..." size="tiny" /></div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CapacityPage() {
  const { user } = useAuth();
  const router = useRouter();
  const token = user?.access_token ?? '';

  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const styles = useStyles();

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'org_admin') router.replace('/dashboard');
  }, [user, router]);

  async function load() {
    if (!token) return;
    try {
      const orgId = user?.role === 'org_admin' ? user.org : null;
      const data = await getHospitalsWithCapacity(token, orgId);
      setHospitals(Array.isArray(data) ? data : data.hospitals ?? []);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load capacity", err);
      setError('Failed to fetch hospital capacity');
    } finally {
      setLoading(false);
    }
  }

  useAutoRefresh(load, POLLING.CAPACITY);

  if (!user || user.role !== 'org_admin') return null;

  const hospital = hospitals[0];

  return (
    <PageShell
      title="Bed Capacity"
      subtitle="Update your hospital's available beds so dispatch always routes to the right destination."
      loading={loading}
    >
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !hospital ? (
        <EmptyState icon={<HeartPulseRegular />} title="No hospital linked" description="Your account is not linked to a hospital organisation. Contact a system admin." />
      ) : (
        <div className={styles.container}>
          <HospitalManager hospital={hospital} token={token} onUpdated={load} />
        </div>
      )}
    </PageShell>
  );
}
