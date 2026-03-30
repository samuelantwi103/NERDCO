'use client';
/**
 * Vehicle Simulation Page — /dashboard/simulate
 *
 * Lets a system_admin pick a vehicle and an open incident, then animates
 * the vehicle moving along a route:
 *   1. Current position → incident location  (en-route)
 *   2. Incident location → nearest hospital  (transport to hospital)
 *
 * Each step calls PUT /vehicles/:id/location so the live tracking database
 * stays current. DashboardMap re-renders via POLLING.SIMULATION (3 s).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Text, Button, Spinner, Dropdown, Option, makeStyles,
  Badge, Divider, Field,
} from '@fluentui/react-components';
import { PlayCircleRegular, StopRegular, ArrowResetRegular, VehicleCarRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { listVehicles, updateVehicleLocation } from '@/lib/api/tracking';
import { listOpenIncidents } from '@/lib/api/incidents';
import { DashboardMap } from '@/app/(ops)/dashboard/DashboardMap';
import { POLLING } from '@/lib/config/polling';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';

// ── Haversine distance (km) ────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Interpolate N waypoints along a straight line ─────────────────────────
function interpolate(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  steps: number,
): Array<{ lat: number; lng: number }> {
  const pts: Array<{ lat: number; lng: number }> = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pts.push({ lat: lat1 + (lat2 - lat1) * t, lng: lng1 + (lng2 - lng1) * t });
  }
  return pts;
}

type SimPhase = 'idle' | 'to_incident' | 'to_hospital' | 'done';

const STEP_INTERVAL_MS = 1_000; // push a location update every 1 second
const STEPS_PER_LEG    = 20;    // 20 steps × 1 s = ~20 s per leg

const useStyles = makeStyles({
  page:    { display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' },
  sidebar: { width: '340px', minWidth: '340px', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 10 },
  header:  { padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: '4px' },
  title:   { fontWeight: '700', fontSize: '18px' },
  sub:     { fontSize: '13px', color: 'var(--color-text-muted)' },
  body:    { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 },
  map:     { flex: 1, position: 'relative' },
  statusBar: {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  actionRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  progressTrack: { height: '6px', borderRadius: '3px', background: 'var(--color-border)', overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: '3px', background: 'var(--color-brand)', transition: 'width 0.8s ease' },
});

export default function SimulatePage() {
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const token = user?.access_token ?? '';

  // ── Data state ─────────────────────────────────────────────────────────
  const [vehicles,  setVehicles]  = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  // ── Selection ──────────────────────────────────────────────────────────
  const [selectedVehicleId,  setSelectedVehicleId]  = useState<string>('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');

  // ── Simulation ─────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState<SimPhase>('idle');
  const [progress,    setProgress]    = useState(0);   // 0-100
  const [statusMsg,   setStatusMsg]   = useState('Select a vehicle and incident to begin.');
  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waypointsRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const stepRef      = useRef(0);
  const phaseRef     = useRef<SimPhase>('idle');

  // ── Auth guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'system_admin') router.replace('/dashboard');
  }, [user, router]);

  // ── Initial data load ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [v, i] = await Promise.all([listVehicles(token), listOpenIncidents(token)]);
      setVehicles(v);
      setLiveVehicles(v);
      setIncidents(i);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Fast polling to refresh live vehicle positions ─────────────────────
  useAutoRefresh(async () => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'done') {
      const v = await listVehicles(token).catch(() => [] as any[]);
      setLiveVehicles(v);
    }
  }, POLLING.SIMULATION);

  // ── Helpers ────────────────────────────────────────────────────────────
  const selectedVehicle  = vehicles.find(v => v.id === selectedVehicleId);
  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  function nearestHospital(): { lat: number; lng: number; name: string } | null {
    // Accra hospitals (fallback static list for demo; real system would query /organizations/hospitals/available)
    const HOSPITALS = [
      { lat: 5.6037, lng: -0.1870, name: 'Korle Bu Teaching Hospital' },
      { lat: 5.6145, lng: -0.1882, name: '37 Military Hospital' },
      { lat: 5.5882, lng: -0.1762, name: 'Ridge Hospital' },
    ];
    if (!selectedIncident) return HOSPITALS[0];
    const inc = selectedIncident;
    return HOSPITALS.slice().sort((a, b) =>
      haversine(inc.latitude, inc.longitude, a.lat, a.lng) -
      haversine(inc.latitude, inc.longitude, b.lat, b.lng)
    )[0];
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // ── Simulation runner ──────────────────────────────────────────────────
  async function startSimulation() {
    if (!selectedVehicle || !selectedIncident) return;
    stopTimer();

    const vLat = selectedVehicle.latitude ?? DEFAULT_VEHICLE_POS.lat;
    const vLng = selectedVehicle.longitude ?? DEFAULT_VEHICLE_POS.lng;
    const iLat = parseFloat(selectedIncident.latitude);
    const iLng = parseFloat(selectedIncident.longitude);

    const hospital = nearestHospital();
    if (!hospital) return;

    // Build full waypoint list: vehicle → incident → hospital
    const leg1 = interpolate(vLat, vLng, iLat, iLng, STEPS_PER_LEG);
    const leg2 = interpolate(iLat, iLng, hospital.lat, hospital.lng, STEPS_PER_LEG);
    const allWaypoints = [...leg1, ...leg2];

    waypointsRef.current = allWaypoints;
    stepRef.current = 0;
    setPhase('to_incident');
    phaseRef.current = 'to_incident';
    setProgress(0);
    setStatusMsg(`Dispatching ${selectedVehicle.license_plate} → ${selectedIncident.location_name ?? 'incident'}`);

    timerRef.current = setInterval(async () => {
      const step = stepRef.current;
      const wps  = waypointsRef.current;
      if (step >= wps.length) {
        stopTimer();
        setPhase('done');
        phaseRef.current = 'done';
        setProgress(100);
        setStatusMsg(`Simulation complete. ${selectedVehicle.license_plate} arrived at ${hospital.name}.`);
        return;
      }

      const { lat, lng } = wps[step];
      try {
        await updateVehicleLocation(token, selectedVehicleId, lat, lng);
      } catch {
        // non-fatal — continue animation
      }

      // Update live vehicle position in local state for instant map refresh
      setLiveVehicles(prev =>
        prev.map(v => v.id === selectedVehicleId ? { ...v, latitude: lat, longitude: lng } : v)
      );

      const newStep = step + 1;
      stepRef.current = newStep;
      const pct = Math.round((newStep / wps.length) * 100);
      setProgress(pct);

      if (newStep === STEPS_PER_LEG) {
        setPhase('to_hospital');
        phaseRef.current = 'to_hospital';
        setStatusMsg(`${selectedVehicle.license_plate} at incident — transporting to ${hospital.name}`);
      }
    }, STEP_INTERVAL_MS);
  }

  function resetSimulation() {
    stopTimer();
    setPhase('idle');
    phaseRef.current = 'idle';
    setProgress(0);
    setStatusMsg('Select a vehicle and incident to begin.');
    loadData();
  }

  // ── Clean up on unmount ────────────────────────────────────────────────
  useEffect(() => () => stopTimer(), []);

  if (!user || user.role !== 'system_admin') return null;

  const phaseLabel: Record<SimPhase, string> = {
    idle:        'Idle',
    to_incident: 'En Route → Incident',
    to_hospital: 'En Route → Hospital',
    done:        'Complete',
  };
  const phaseColor: Record<SimPhase, React.CSSProperties['color']> = {
    idle:        'var(--color-text-muted)',
    to_incident: 'var(--color-dispatched)',
    to_hospital: 'var(--color-in-progress)',
    done:        'var(--color-available)',
  };

  return (
    <div className={styles.page}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <Text className={styles.title}>Vehicle Simulation</Text>
          <Text className={styles.sub}>Animate a dispatch from incident to hospital</Text>
        </div>
        <Divider style={{ margin: '16px 0 0' }} />

        <div className={styles.body}>
          {loading ? (
            <Spinner size="small" label="Loading fleet data…" />
          ) : (
            <>
              {/* Vehicle selector */}
              <Field label="Vehicle">
                <Dropdown
                  placeholder="Select a vehicle"
                  value={selectedVehicle ? `${selectedVehicle.license_plate} · ${selectedVehicle.vehicle_type?.replace(/_/g, ' ')}` : ''}
                  onOptionSelect={(_, d) => setSelectedVehicleId(d.optionValue ?? '')}
                  disabled={phase !== 'idle'}
                >
                  {vehicles.map(v => {
                    const label = `${v.license_plate} · ${v.vehicle_type?.replace(/_/g, ' ')} · ${v.status}`;
                    return (
                      <Option key={v.id} value={v.id} text={label}>
                        {label}
                      </Option>
                    );
                  })}
                </Dropdown>
              </Field>

              {/* Incident selector */}
              <Field label="Incident">
                <Dropdown
                  placeholder="Select an open incident"
                  value={selectedIncident ? (selectedIncident.location_name ?? selectedIncident.id) : ''}
                  onOptionSelect={(_, d) => setSelectedIncidentId(d.optionValue ?? '')}
                  disabled={phase !== 'idle'}
                >
                  {incidents.map(i => {
                    const label = `[${i.incident_type ?? i.type_id}] ${i.location_name ?? i.id} · ${i.status}`;
                    return (
                      <Option key={i.id} value={i.id} text={label}>
                        {label}
                      </Option>
                    );
                  })}
                </Dropdown>
              </Field>

              <Divider />

              {/* Status */}
              <div className={styles.statusBar}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Status</Text>
                  <Badge
                    appearance="filled"
                    color={phase === 'done' ? 'success' : phase === 'idle' ? 'informative' : 'warning'}
                    size="small"
                  >
                    {phaseLabel[phase]}
                  </Badge>
                </div>
                <Text style={{ fontSize: '13px', color: phaseColor[phase] }}>{statusMsg}</Text>
                {phase !== 'idle' && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {phase === 'to_incident' ? 'To incident' : phase === 'to_hospital' ? 'To hospital' : 'Complete'}
                      </Text>
                      <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{progress}%</Text>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className={styles.actionRow}>
                {phase === 'idle' || phase === 'done' ? (
                  <Button
                    appearance="primary"
                    icon={<PlayCircleRegular />}
                    onClick={startSimulation}
                    disabled={!selectedVehicleId || !selectedIncidentId}
                    style={{ minHeight: '48px', flex: 1 }}
                  >
                    {phase === 'done' ? 'Run Again' : 'Start Simulation'}
                  </Button>
                ) : (
                  <Button
                    appearance="secondary"
                    icon={<StopRegular />}
                    onClick={resetSimulation}
                    style={{ minHeight: '48px', flex: 1 }}
                  >
                    Stop
                  </Button>
                )}
                <Button
                  appearance="subtle"
                  icon={<ArrowResetRegular />}
                  onClick={resetSimulation}
                  style={{ minHeight: '48px' }}
                  aria-label="Reset"
                />
              </div>

              {/* Selected vehicle info */}
              {selectedVehicle && (
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <VehicleCarRegular fontSize={14} />
                    <Text style={{ fontSize: '12px', fontWeight: 700 }}>{selectedVehicle.license_plate}</Text>
                  </div>
                  <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Type: {selectedVehicle.vehicle_type?.replace(/_/g, ' ')}</Text>
                  <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Status: {selectedVehicle.status}</Text>
                  {selectedVehicle.latitude && (
                    <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Pos: {parseFloat(selectedVehicle.latitude).toFixed(5)}, {parseFloat(selectedVehicle.longitude).toFixed(5)}
                    </Text>
                  )}
                </div>
              )}

              <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                The simulation pushes a GPS update to the tracking service every second.
                The map refreshes every {POLLING.SIMULATION / 1000} s to reflect real-time position.
                Each leg (en-route & to-hospital) is divided into {STEPS_PER_LEG} interpolated steps (~{STEPS_PER_LEG}s per leg).
              </Text>
            </>
          )}
        </div>
      </aside>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className={styles.map}>
        <DashboardMap
          incidents={incidents}
          vehicles={liveVehicles}
          selectedId={null}
          onSelect={(id) => { if (phase === 'idle') setSelectedIncidentId(id); }}
        />
      </div>
    </div>
  );
}

// Fallback position if vehicle has no stored location (Accra city center)
const DEFAULT_VEHICLE_POS = { lat: 5.6037, lng: -0.1870 };
