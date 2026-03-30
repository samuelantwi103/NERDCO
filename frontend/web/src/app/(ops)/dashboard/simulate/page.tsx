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
  Badge, Divider, Field, TabList, Tab
} from '@fluentui/react-components';
import { PlayCircleRegular, StopRegular, ArrowResetRegular, VehicleCarRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { listVehicles, startSimulationRun, stopSimulationRun, getActiveSimulations, resumeSimulationRun } from '@/lib/api/tracking';
import { listOpenIncidents, updateIncidentStatus, requestSupport as apiRequestSupport } from '@/lib/api/incidents';
import { listOrganizations } from '@/lib/api/auth';
import { loadGoogleMaps } from '@/lib/maps/loader';
import { DashboardMap, type Facility } from '@/app/(ops)/dashboard/DashboardMap';
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

/** Request a driving route from Google Maps DirectionsService.
 *  Returns an array of LatLng points covering the full path (vehicle → incident → hospital). */
async function getDrivingRoute(
  origin: google.maps.LatLngLiteral,
  waypoint: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<Array<{ lat: number; lng: number }>> {
  return new Promise((resolve) => {
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin,
        destination,
        waypoints: [{ location: waypoint, stopover: true }],
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          // Fallback: straight-line interpolation if directions unavailable
          const pts: Array<{ lat: number; lng: number }> = [];
          const steps = 40;
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            pts.push({ lat: origin.lat + (waypoint.lat - origin.lat) * t, lng: origin.lng + (waypoint.lng - origin.lng) * t });
          }
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            pts.push({ lat: waypoint.lat + (destination.lat - waypoint.lat) * t, lng: waypoint.lng + (destination.lng - waypoint.lng) * t });
          }
          resolve(pts);
          return;
        }
        const path: Array<{ lat: number; lng: number }> = [];
        result.routes[0].legs.forEach(leg => {
          leg.steps.forEach(step => {
            step.path.forEach(p => path.push({ lat: p.lat(), lng: p.lng() }));
          });
        });
        resolve(path);
      },
    );
  });
}

type SimPhase = 'idle' | 'starting' | 'to_incident' | 'at_scene' | 'to_hospital' | 'to_base' | 'done';

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
  const [vehicles,   setVehicles]   = useState<any[]>([]);
  const [incidents,  setIncidents]  = useState<any[]>([]);
  const [hospitals,  setHospitals]  = useState<Facility[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [routePath,  setRoutePath]  = useState<Array<{ lat: number; lng: number }>>([]);

  // ── Selection ──────────────────────────────────────────────────────────
  const [selectedVehicleId,  setSelectedVehicleId]  = useState<string>('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');

  // ── Simulation ─────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState<SimPhase>('idle');
  const [progress,    setProgress]    = useState(0);   // 0-100
  const [statusMsg,   setStatusMsg]   = useState('Select a vehicle and incident to begin.');
  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
  const [activeGlobalSims, setActiveGlobalSims] = useState<any[]>([]);
  const [pastGlobalSims, setPastGlobalSims] = useState<any[]>([]);
  const [panelTab, setPanelTab] = useState<'dispatch' | 'manage'>('dispatch');
  const [mounted, setMounted] = useState(false);
  
  // Track geometry
  const [fullRoutePath, setFullRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [routeSplitIdx, setRouteSplitIdx] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Periodically check global simulation state
  useEffect(() => {
    if (!token) return;
    const t = setInterval(async () => {
      try {
        const { simulations: sims, past } = await getActiveSimulations(token);
        setActiveGlobalSims(sims);
        setPastGlobalSims(past || []);
        if (selectedVehicleId) {
          const mySim = sims.find((s: any) => s.vehicleId === selectedVehicleId);
          if (mySim) {
            setPhase(mySim.phase as SimPhase);
            setProgress(Math.round((mySim.currentStep / mySim.totalSteps) * 100));
            setStatusMsg(`Remote execution: ${mySim.currentStep} / ${mySim.totalSteps} steps completed...`);
            
            // Constrain map Polyline to the currently active leg
            if (fullRoutePath.length > 0) {
              if (mySim.phase === 'to_incident') {
                setRoutePath(fullRoutePath.slice(0, routeSplitIdx));
              } else if (mySim.phase === 'at_scene') {
                setRoutePath([]); // Paused, no moving path necessary
              } else if (mySim.phase === 'to_hospital' || mySim.phase === 'to_base') {
                setRoutePath(fullRoutePath.slice(routeSplitIdx));
              }
            }
          } else if (phase !== 'idle' && phase !== 'done' && phase !== 'starting') {
            setPhase('done');
            setProgress(100);
            setStatusMsg('Simulation completed.');
            setRoutePath([]);
            setFullRoutePath([]);
          }
        }
      } catch (err) {}
    }, 1500);
    return () => clearInterval(t);
  }, [token, selectedVehicleId, phase]);

  // ── Auth guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'system_admin') router.replace('/dashboard');
  }, [user, router]);

  // ── Initial data load ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [v, i, orgs] = await Promise.all([
        listVehicles(token),
        listOpenIncidents(token),
        listOrganizations(token),
      ]);
      setVehicles(v);
      setLiveVehicles(v);
      setIncidents(i);
      const facs: Facility[] = orgs
        .filter((o: any) => o.latitude && o.longitude)
        .map((o: any) => ({
          id:   o.id,
          lat:  parseFloat(o.latitude),
          lng:  parseFloat(o.longitude),
          name: o.name,
          type: o.type ?? o.org_type ?? 'hospital',
        }));
      setFacilities(facs);
      setHospitals(facs.filter(f => f.type === 'hospital' || f.type === 'ambulance_service'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Fast polling to refresh live vehicle positions ─────────────────────
  useAutoRefresh(async () => {
    const v = await listVehicles(token).catch(() => [] as any[]);
    setLiveVehicles(v);
  }, POLLING.SIMULATION);

  // ── Helpers ────────────────────────────────────────────────────────────
  const selectedVehicle  = vehicles.find(v => v.id === selectedVehicleId);
  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  function nearestHospital(): Facility | null {
    if (hospitals.length === 0) return null;
    if (!selectedIncident) return hospitals[0];
    const iLat = parseFloat(selectedIncident.latitude);
    const iLng = parseFloat(selectedIncident.longitude);
    return hospitals.slice().sort((a, b) =>
      haversine(iLat, iLng, a.lat, a.lng) - haversine(iLat, iLng, b.lat, b.lng)
    )[0];
  }

  async function stopTimer() {
    if (!selectedVehicleId) return;
    try {
      await stopSimulationRun(token, selectedVehicleId);
      setPhase('idle');
      setProgress(0);
      setStatusMsg('Simulation stopped.');
    } catch {}
  }

  // ── Simulation runner ──────────────────────────────────────────────────
  async function startSimulation() {
    if (!selectedVehicle || !selectedIncident) return;
    try { await stopSimulationRun(token, selectedVehicle.id); } catch {}

    const isMedical = selectedVehicle.vehicle_type === 'ambulance' || selectedVehicle.vehicle_type?.includes('medical');

    const vLat = parseFloat(selectedVehicle.latitude) || DEFAULT_VEHICLE_POS.lat;
    const vLng = parseFloat(selectedVehicle.longitude) || DEFAULT_VEHICLE_POS.lng;
    const iLat = parseFloat(selectedIncident.latitude);
    const iLng = parseFloat(selectedIncident.longitude);

    let destinationLat = vLat;
    let destinationLng = vLng;
    let destinationName = 'Base';

    const hospital = nearestHospital();
    if (isMedical && hospital) {
      destinationLat = hospital.lat;
      destinationLng = hospital.lng;
      destinationName = hospital.name;
    } else if (isMedical && !hospital) {
      return; // Can't proceed
    }

    setPhase('starting');
    setProgress(0);
    setStatusMsg(`Offloading path-finding for ${selectedVehicle.license_plate} to backend…`);

    // Ensure Maps API is loaded, then get real driving route locally
    await loadGoogleMaps(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '');
    const allWaypoints = await getDrivingRoute(
      { lat: vLat, lng: vLng },
      { lat: iLat, lng: iLng },
      { lat: destinationLat, lng: destinationLng },
    );

    // Find the leg-split index (closest point to the incident)
    let splitIdx = 0;
    let minDist = Infinity;
    allWaypoints.forEach((p, idx) => {
      const d = haversine(p.lat, p.lng, iLat, iLng);
      if (d < minDist) { minDist = d; splitIdx = idx; }
    });

    setStatusMsg(`Dispatching waypoint graph. Running headlessly...`);

    try {
      await startSimulationRun(token, selectedVehicle.id, {
        incidentId: selectedIncident.id,
        isMedical,
        destinationName,
        path: allWaypoints,
        splitIdx,
        speedMs: STEP_INTERVAL_MS,
      });
      setFullRoutePath(allWaypoints);
      setRouteSplitIdx(splitIdx);
      setRoutePath(allWaypoints.slice(0, splitIdx)); // Show only first leg initially
    } catch (err: any) {
      setStatusMsg(`Failed to start simulation: ${err?.message}`);
      setPhase('idle');
    }
  }

  async function resetSimulation() {
    await stopTimer();
    setPhase('idle');
    setProgress(0);
    setRoutePath([]);
    setFullRoutePath([]);
    setStatusMsg('Select a vehicle and incident to begin.');
    loadData();
  }

  // ── Clean up on unmount ────────────────────────────────────────────────
  useEffect(() => {}, []);

  if (!mounted) return null;
  if (!user || user.role !== 'system_admin') return null;

  const phaseLabel: Record<SimPhase | 'starting', string> = {
    idle:        'Idle',
    starting:    'Starting',
    to_incident: 'En Route → Incident',
    at_scene:    'At Scene (Paused)',
    to_hospital: 'En Route → Hospital',
    to_base:     'En Route → Base',
    done:        'Complete',
  };
  const phaseColor: Record<SimPhase | 'starting', React.CSSProperties['color']> = {
    idle:        'var(--color-text-muted)',
    starting:    'var(--color-brand)',
    to_incident: 'var(--color-dispatched)',
    at_scene:    'var(--color-warning)',
    to_hospital: 'var(--color-in-progress)',
    to_base:     'var(--color-in-progress)',
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

        <TabList selectedValue={panelTab} onTabSelect={(_, d) => setPanelTab(d.value as any)} style={{ padding: '0 20px', marginTop: '12px' }}>
          <Tab value="dispatch">Dispatch</Tab>
          <Tab value="manage">Manager</Tab>
        </TabList>
        <Divider style={{ margin: '0' }} />

        <div className={styles.body}>
          {loading ? (
            <Spinner size="small" label="Loading fleet data…" />
          ) : panelTab === 'dispatch' ? (
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
                  {incidents.filter(i => !i.parent_incident_id).map(i => {
                    const childCount = incidents.filter(c => c.parent_incident_id === i.id).length;
                    const mciSuffix = childCount > 0 ? ` · MCI (${childCount + 1} units)` : '';
                    const label = `[${i.incident_type ?? i.type_id}] ${i.location_name ?? i.id} · ${i.status}${mciSuffix}`;
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
                        {phase === 'to_incident' ? 'To incident' : phase === 'to_hospital' ? 'To hospital' : phase === 'to_base' ? 'To base' : 'Complete'}
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
          ) : (
            <>
              <div>
                <Text weight="semibold" style={{ display: 'block', marginBottom: '8px' }}>
                  Active Runs ({activeGlobalSims.length})
                </Text>
                {activeGlobalSims.length === 0 ? (
                  <Text style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No active simulations.</Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeGlobalSims.map((sim, i) => {
                      const veh = vehicles.find(v => v.id === sim.vehicleId);
                      return (
                        <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text weight="semibold" style={{ fontSize: '13px' }}>{veh?.license_plate || sim.vehicleId.slice(0, 8)}</Text>
                            <Badge appearance="filled" color="warning" size="small">{sim.phase.replace('_', ' ')}</Badge>
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Progress</Text>
                              <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{Math.round((sim.currentStep / sim.totalSteps) * 100)}%</Text>
                            </div>
                            <div className={styles.progressTrack}>
                              <div className={styles.progressFill} style={{ width: `${(sim.currentStep / sim.totalSteps) * 100}%` }} />
                            </div>
                          </div>
                          <Button size="small" appearance="secondary" onClick={async () => {
                            await stopSimulationRun(token, sim.vehicleId);
                          }}>Stop Run</Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <Text weight="semibold" style={{ display: 'block', marginBottom: '8px' }}>
                  Recent History ({pastGlobalSims.length})
                </Text>
                {pastGlobalSims.length === 0 ? (
                  <Text style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No finished simulations yet.</Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pastGlobalSims.slice(0, 10).map((sim, i) => {
                      const veh = vehicles.find(v => v.id === sim.vehicleId);
                      return (
                        <div key={i} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Text weight="semibold" style={{ fontSize: '12px' }}>{veh?.license_plate || sim.vehicleId.slice(0, 8)}</Text>
                            <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Ended: {new Date(sim.completedAt).toLocaleTimeString()}</Text>
                          </div>
                          <Badge color={sim.reason === 'completed' ? 'success' : 'danger'} size="small">
                            {sim.reason}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div className={styles.map}>
        <DashboardMap
          incidents={incidents}
          vehicles={liveVehicles}
          facilities={facilities}
          selectedId={null}
          onSelect={(id) => { if (phase === 'idle') setSelectedIncidentId(id); }}
          simulationPath={routePath}
          hidePOIs={true}
        />
      </div>
    </div>
  );
}

// Fallback position if vehicle has no stored location (Accra city center)
const DEFAULT_VEHICLE_POS = { lat: 5.6037, lng: -0.1870 };
