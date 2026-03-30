'use client';
import { FormEvent, useState, useEffect } from 'react';
import {
  Button, Field, Input, Textarea, Select, Text, Spinner, Switch, SpinButton,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent,
  makeStyles,
} from '@fluentui/react-components';
import { useAuth } from '@/lib/context/AuthContext';
import { LocationPicker } from '@/components/LocationPicker';
import { useNewIncident } from './useNewIncident';
import { DispatchResult } from './DispatchResult';
import { useRouter } from 'next/navigation';

const useStyles = makeStyles({
  page: { display: 'flex', height: '100%', overflow: 'hidden' },
  form: {
    width: '380px',
    maxWidth: '100%',
    padding: '24px 20px',
    borderRight: '1px solid var(--color-border)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    background: 'var(--color-surface)',
  },
  heading:    { fontWeight: '700', fontSize: '18px', letterSpacing: '-0.3px' },
  sub:        { fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '-8px' },
  locLabel:   { fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '-6px' },
  locBox: {
    padding: '10px 12px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '12px',
    color: 'var(--color-text-muted)',
  },
  error: {
    padding: '10px 14px',
    background: 'var(--color-fire-bg)',
    border: '1px solid var(--color-fire-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    color: 'var(--color-fire)',
  },
  submitBtn: {
    background: 'var(--gray-950)',
    border: 'none',
    minHeight: '48px',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: 'var(--radius-md)',
  },
});

const TYPES = ['medical', 'fire', 'robbery', 'crime'];

function DuplicateConflictModal({ conflict, onDismiss }: { conflict: any; onDismiss: () => void }) {
  const router = useRouter();
  if (!conflict) return null;

  return (
    <Dialog open={!!conflict} onOpenChange={(_, data) => !data.open && onDismiss()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Duplicate Incident Detected</DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Text>An open <b>{conflict.incident_type}</b> incident already exists within 200m of this location.</Text>
              <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <Text size={200} block style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>EXISTING INCIDENT</Text>
                <Text block font="numeric"><b>Callers:</b> {conflict.citizen_name}</Text>
                <Text block><b>Status:</b> <span style={{ textTransform: 'capitalize' }}>{conflict.status}</span></Text>
                <Text block><b>Unit:</b> {conflict.assigned_unit_id || 'Awaiting dispatch'}</Text>
              </div>
              <Text size={200}>Would you like to view the existing incident instead of creating a new one?</Text>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onDismiss}>Dismiss</Button>
            <Button appearance="primary" onClick={() => router.push(`/dashboard?highlight=${conflict.id}`)}>
              View Incident
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export default function NewIncidentPage() {
  const styles = useStyles();
  const { user } = useAuth();
  const token = user?.access_token ?? '';
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(() => { setMapMounted(true); }, []);

  const { state, actions } = useNewIncident(token);
  const { location, type, caller, notes, loading, result, assignedVehicle, overriding, error, clockDeltaMs, multipleCasualties, mciUnits, conflict, requiredCapability } = state;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await actions.submitIncident();
  }

  return (
    <div className={styles.page}>
      <DuplicateConflictModal conflict={conflict} onDismiss={() => actions.setConflict(null)} />
      
      {/* Left: form */}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div>
          <Text className={styles.heading}>New Incident</Text>
          <Text className={styles.sub}>Drop a pin on the map, then complete the form.</Text>
        </div>

        <Field label="Incident type" required>
          <Select value={type} onChange={e => actions.setType(e.target.value)}>
            {TYPES.map(t => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <Text style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>
            Incident location
          </Text>
          <div className={styles.locBox}>
            {location ? (
              <>
                <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>{location.name}</span>
                <br />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </span>
              </>
            ) : (
              'No pin dropped yet — click on the map →'
            )}
          </div>
        </div>

        <Field label="Caller name">
          <Input
            value={caller}
            onChange={e => actions.setCaller(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={e => actions.setNotes(e.target.value)}
            rows={3}
            placeholder="Brief description"
          />
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
          <Switch
            checked={multipleCasualties}
            onChange={(e, data) => actions.setMultipleCasualties(data.checked)}
            label="Multiple casualties (MCI)"
          />
          {multipleCasualties && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
              <Text style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
                Units to dispatch
              </Text>
              {[
                { key: 'ambulance',  label: 'Ambulances' },
                { key: 'fire_truck', label: 'Fire trucks' },
                { key: 'police_car', label: 'Police cars' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <Text style={{ fontSize: '13px', flex: 1 }}>{label}</Text>
                  <SpinButton
                    value={mciUnits[key] ?? 0}
                    min={0}
                    max={10}
                    style={{ width: '90px' }}
                    onChange={(_, data) => data.value !== undefined && data.value !== null && actions.setMciUnit(key, data.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {!result ? (
          <Button
            type="submit"
            appearance="primary"
            disabled={loading || !location}
            className={styles.submitBtn}
          >
            {loading ? <Spinner size="tiny" /> : 'Dispatch'}
          </Button>
        ) : (
          <DispatchResult
            result={result}
            assignedVehicle={assignedVehicle}
            overriding={overriding}
            clockDeltaMs={clockDeltaMs}
            onOverride={actions.overrideAssignment}
            onDone={actions.done}
          />
        )}
      </form>

      {/* Right: map — rendered only after client mount to avoid SSR/hydration issues */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {mapMounted ? (
          <LocationPicker value={location} onChange={actions.setLocation} height="100%" />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size="small" label="Loading map…" />
          </div>
        )}
      </div>
    </div>
  );
}
