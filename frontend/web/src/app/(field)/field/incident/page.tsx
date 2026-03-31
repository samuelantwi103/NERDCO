'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Text, Spinner, Button, makeStyles, Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent } from '@fluentui/react-components';
import { ArrowLeftRegular, ArrowTurnRightRegular, ArrowTurnLeftUpRegular as ArrowTurnLeftRegular, ArrowUpRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { POLLING } from '@/lib/config/polling';
import {
  getIncident, updateIncidentStatus, requestSupport, getRelatedIncidents,
} from '@/lib/api/incidents';
import { listVehicles, getActiveSimulations, resumeSimulationRun } from '@/lib/api/tracking';
import { loadGoogleMaps } from '@/lib/maps/loader';
import { consumeMapLoad } from '@/lib/maps/quota';
import { showInfoPopup, dismissInfoPopup } from '@/lib/maps/infoPopup';
import { makeIncidentPin, makeMyLocationPin, makeVehiclePin, INCIDENT_COLOR } from '@/app/(ops)/dashboard/DashboardMap';
import { IncidentTypeChip }    from '@/components/IncidentTypeChip';
import { IncidentStatusBadge } from '@/components/StatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';


// Suppress Google Maps DirectionsService deprecation warnings which clutter Next.js terminal
if (typeof window !== 'undefined') {
  const origWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('is deprecated as of February 25th, 2026')) return;
    if (typeof args[0] === 'string' && args[0].includes('DirectionsRenderer is deprecated')) return;
    origWarn.apply(console, args);
  };
  const origError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('is deprecated as of February 25th, 2026')) return;
    if (typeof args[0] === 'string' && args[0].includes('DirectionsRenderer is deprecated')) return;
    origError.apply(console, args);
  };
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function makeBackupPin(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `width:13px;height:13px;border-radius:50%;background:#0097A7;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);`;
  return el;
}

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' },
  topBar: {
    display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10,
    padding: '12px 16px', borderBottom: '1px solid var(--color-border)', 
    background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
  },
  topTitle: { fontWeight: '700', fontSize: '16px', flex: 1 },
  mapBox: { flex: 1, position: 'relative', background: 'var(--color-bg)', overflow: 'hidden' },
  navTopBox: {
      position: 'absolute', top: '12px', left: '12px', right: '12px',
      background: '#0d4722', color: '#fff', borderRadius: '12px', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100,
      maxWidth: '500px', margin: '0 auto',
      '@media (min-width: 768px)': {
        left: '24px', right: 'auto', top: '24px', margin: 0, width: '400px'
      }
    },
    navMainText: { fontSize: '18px', fontWeight: '600' },
  navSubText: { fontSize: '13px', opacity: 0.9 },
  navBottomBox: {
    position: 'absolute', bottom: '24px', left: 'auto', right: '16px',
    background: '#fff', borderRadius: '16px', padding: '8px 16px',      
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '2px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, 
  },
  durationText: { fontSize: '18px', fontWeight: 'bold', color: '#b36b00' },
  distanceText: { fontSize: '13px', color: '#666', fontWeight: '500' },
  legend: {
      position: 'absolute', top: '100px', left: '12px', background: 'rgba(255,255,255,0.9)',
      padding: '8px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', zIndex: 100,
      backdropFilter: 'blur(4px)', pointerEvents: 'none'
    },
  bottomPanel: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--color-surface)', borderTopLeftRadius: '24px',
      borderTopRightRadius: '24px', zIndex: 200,
      boxShadow: '0 -8px 24px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      height: 'auto', maxHeight: '60vh', transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      maxWidth: '500px', margin: '0 auto',
      '@media (min-width: 768px)': {
        left: 'auto', right: '24px', bottom: '24px', margin: 0, width: '400px',
        borderRadius: '24px', maxHeight: 'calc(100% - 120px)'
      }
    },
    dragHandle: {
    width: '40px', height: '4px', background: 'var(--color-border)', borderRadius: '2px',
    margin: '12px auto', cursor: 'pointer'
  },
  bodyScroll: {
    padding: '0 20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
    flex: 1
  },
  body: {},
  detailRow: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' },
  value: { fontSize: '15px' },
  actions: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '12px 16px', borderTop: '1px solid var(--color-border)',
    background: 'var(--color-surface)', flexShrink: 0
  },
  supportBox: {
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    borderRadius: '8px', padding: '12px 14px', display: 'flex',
    flexDirection: 'column', gap: '6px', fontSize: '14px',
  },
  supportTitle: { fontWeight: '600', fontSize: '14px' },
  error: { color: 'var(--color-fire)', fontSize: '14px' },

});

function FieldIncidentContent() {
  const styles  = useStyles();
  const router  = useRouter();
  const params  = useSearchParams();
  const incId   = params.get('id') ?? '';
  const { user } = useAuth();
  const token = user?.access_token ?? '';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<google.maps.Map | null>(null);
  const incMarkerRef    = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const myLocMarkerRef  = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const backupMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [navInfo, setNavInfo] = useState<any>(null);
  const routeFetchedRef = useRef(false);
  const popupRef        = useRef<HTMLElement | null>(null);
  const lastInteractionRef = useRef(0);
  const lastRouteFetchRef = useRef(0);

  const getManeuverIcon = (maneuver?: string) => {
    if (!maneuver) return <ArrowUpRegular fontSize={32} />;
    if (maneuver.includes('right')) return <ArrowTurnRightRegular fontSize={32} />;
    if (maneuver.includes('left')) return <ArrowTurnLeftRegular fontSize={32} />;
    return <ArrowUpRegular fontSize={32} />;
  };
  const [mapReady, setMapReady] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{title: string, content: string, action: () => void} | null>(null);

  const handleRecenter = () => {
    if (mapRef.current && myLocation) {
      mapRef.current.setZoom(18);
      mapRef.current.panTo(myLocation);
    }
  };
  const [incident,    setIncident]    = useState<any | null>(null);
  const [related,     setRelated]     = useState<any[]>([]);
  const [vehicles,    setVehicles]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [acting,      setActing]      = useState(false);
  const [error,       setError]       = useState('');
  const [supportType, setSupportType] = useState<string | null>(null);
  const [myLocation,  setMyLocation]  = useState<{lat: number, lng: number} | null>(null);
  const [isUnderSimulation, setIsUnderSimulation] = useState(false);
  const [simPhase, setSimPhase] = useState<string | null>(null);
  const [simDestinationName, setSimDestinationName] = useState<string | null>(null);
  const [myVehicle, setMyVehicle] = useState<any | null>(null);

  useEffect(() => {
    setMounted(true);
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'first_responder') router.replace('/dashboard');
  }, [user, router]);

  // Eager simulation check - also tracks phase + destination for route switching
  useEffect(() => {
    if (!token || !mounted) return;
    const checkSim = async () => {
      try {
        const data = await getActiveSimulations(token);
        const sims = data.simulations || data.active || [];
        const mySim = sims.find((s: any) => s.vehicleId === myVehicle?.id);
        const isSim = !!mySim;
        if (isSim !== isUnderSimulation) setIsUnderSimulation(isSim);
        if (mySim) {
          const newPhase = mySim.phase ?? null;
          if (newPhase !== simPhase) {
            setSimPhase(newPhase);
            // When phase switches to to_hospital, reset route so it redraws to hospital
            if (newPhase === 'to_hospital') {
              routeFetchedRef.current = false;
              lastRouteFetchRef.current = 0;
            }
          }
          if (mySim.destinationName) setSimDestinationName(mySim.destinationName);
        } else {
          setSimPhase(null);
        }
      } catch (e) {
        // ignore errors
      }
    };
    checkSim();
    const iv = setInterval(checkSim, 5000);
    return () => clearInterval(iv);
  }, [token, mounted, myVehicle?.id, isUnderSimulation, simPhase]);

  // Load vehicles once for backup plate lookup
  useEffect(() => {
    if (!token) return;
    listVehicles(token).then(v => setVehicles(v as any[])).catch(() => {});
  }, [token]);

  const { error: incError } = useAutoRefresh(async () => {
    if (!incId) return;
    const [inc, rel, veh] = await Promise.all([
      getIncident(token, incId),
      getRelatedIncidents(token, incId),
      listVehicles(token).catch(() => [] as any[])
    ]);
    setIncident(inc);
    setRelated(rel);
    if (veh && veh.length > 0) {
      setVehicles(veh);
      const mine = (veh as any[]).find(v => v.driver_user_id === user?.id);
      setMyVehicle(mine ?? null);
    }
    setLoading(false);
  }, POLLING.FIELD);

  // Init map
  useEffect(() => {
    if (!MAPS_KEY || !mapContainerRef.current || mapRef.current || !incident) return;
    if (!consumeMapLoad()) return;

    const lat = parseFloat(incident.latitude);
    const lng = parseFloat(incident.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    loadGoogleMaps(MAPS_KEY).then(() => {
      if (!mapContainerRef.current || mapRef.current) return;
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat, lng },
        zoom: 15,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        zoomControl: false,
      });
      map.addListener('click', () => dismissInfoPopup(popupRef));
      map.addListener('dragstart', () => { lastInteractionRef.current = Date.now(); });
      map.addListener('zoom_changed', () => { lastInteractionRef.current = Date.now(); });
      mapRef.current = map;

      const incType = (incident.incident_type ?? '').toLowerCase();
      const isAwaiting = !incident.assigned_unit_id && incident.status !== 'resolved';
      const incMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        map,
        title: incident.location_name ?? 'Incident',
        content: makeIncidentPin(incType, false, 0, isAwaiting),
        zIndex: 10,
      });
      incMarker.addListener('gmp-click', () => {
        if (mapContainerRef.current) {
          showInfoPopup(mapContainerRef.current, incMarker, map, {
            title: incident.location_name ?? 'Incident',
            lines: [
              `Type: ${incType || '—'}`,
              `Status: ${incident.status ?? '—'}`,
              ...(incident.citizen_name ? [`Caller: ${incident.citizen_name}`] : []),
              `Reported: ${new Date(incident.created_at).toLocaleTimeString()}`,
            ],
          }, popupRef);
        }
      });
      incMarkerRef.current = incMarker;

      setMapReady(true);
    }).catch(() => {});
  }, [incident]);

  // Removed DirectionsRenderer cleanup; we want the track to outline the path to the incident
  // even under simulation, as requested by the user.

  // Auto-recenter ticking
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > 5000) {
        const curr = (isUnderSimulation && myVehicle) ? { lat: parseFloat(myVehicle.latitude), lng: parseFloat(myVehicle.longitude) } : myLocation;
        if (curr && !isNaN(curr.lat) && mapRef.current) {
          mapRef.current.panTo(curr);
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [isUnderSimulation, myVehicle, myLocation]);

  // Update my-location marker + draw route (once)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !myLocation || !window.google?.maps?.marker) return;

    // My location marker (hidden if simulation active)
    if (isUnderSimulation || !myLocation) {
      if (myLocMarkerRef.current) {
        myLocMarkerRef.current.map = null;
        myLocMarkerRef.current = null;
      }
    } else {
        if (myLocMarkerRef.current) {
          myLocMarkerRef.current.position = myLocation;
          if (!myLocMarkerRef.current.map) myLocMarkerRef.current.map = mapRef.current;
        } else {
          const myMarker = new google.maps.marker.AdvancedMarkerElement({
            position: myLocation,
            map: mapRef.current,
            title: 'My location',
            content: makeMyLocationPin(),
            zIndex: 999,
          });
          myMarker.addListener('gmp-click', () => {
            if (mapContainerRef.current && mapRef.current) {
              showInfoPopup(mapContainerRef.current, myMarker, mapRef.current, {
                title: 'Your location',
                lines: [
                  `Lat: ${myLocation.lat.toFixed(5)}`,
                  `Lng: ${myLocation.lng.toFixed(5)}`,
                ],
              }, popupRef);
            }
          });
          myLocMarkerRef.current = myMarker;
        }
    }

    // Draw route periodically so the banner and track update
    if (incident && (incident.status === 'dispatched' || incident.status === 'in_progress')) {
      const currentOrigin = (isUnderSimulation && myVehicle) ? { lat: parseFloat(myVehicle.latitude), lng: parseFloat(myVehicle.longitude) } : myLocation;

      // Destination: switch to hospital when driving to hospital phase
      const isDrivingToHospital = simPhase === 'to_hospital' && simDestinationName;
      const destLat = isDrivingToHospital ? null : parseFloat(incident.latitude);
      const destLng = isDrivingToHospital ? null : parseFloat(incident.longitude);

      if (currentOrigin && !isNaN(currentOrigin.lat)) {
        const now = Date.now();
        if (now - lastRouteFetchRef.current > 5000) {
          lastRouteFetchRef.current = now;
          const ds = new google.maps.DirectionsService();
          if (!directionsRendererRef.current) {
            directionsRendererRef.current = new google.maps.DirectionsRenderer({
              map: mapRef.current!,
              suppressMarkers: true,
              preserveViewport: true,
              polylineOptions: { strokeColor: '#4285F4', strokeWeight: 8, strokeOpacity: 0.9 },
            });
          }

          const routeDestination: google.maps.DirectionsRequest['destination'] = isDrivingToHospital
            ? simDestinationName! // geocode by hospital name
            : { lat: destLat!, lng: destLng! };

          if (isDrivingToHospital || (!isNaN(destLat!) && !isNaN(destLng!))) {
            ds.route({
              origin: currentOrigin,
              destination: routeDestination,
              travelMode: google.maps.TravelMode.DRIVING,
            }, (res, status) => {
              if (status === 'OK' && res) {
                directionsRendererRef.current!.setDirections(res);
                if (!routeFetchedRef.current) {
                  routeFetchedRef.current = true;
                  mapRef.current!.setZoom(18);
                  mapRef.current!.panTo(currentOrigin!);
                }
                const route = res.routes[0];
                const leg = route.legs[0];
                const step = leg.steps[0];
                setNavInfo({
                  distance: leg.distance?.text,
                  duration: leg.duration?.text,
                  nextStepDist: step?.distance?.text,
                  nextStepText: step?.instructions?.replace(/<[^>]*>?/gm, ''), // strip html
                  maneuver: step?.maneuver
                });
              }
            });
          }
        }
      }
    }
  }, [myLocation, myVehicle, mapReady, incident, isUnderSimulation, simPhase, simDestinationName]);

  // Backup vehicle markers + Personal vehicle during simulation
  const myVehMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;

    // Handle personal vehicle marker (simulation only)
    if (isUnderSimulation && myVehicle && myVehicle.latitude && myVehicle.longitude) {
        const pos = { lat: parseFloat(myVehicle.latitude), lng: parseFloat(myVehicle.longitude) };
        if (!isNaN(pos.lat) && !isNaN(pos.lng)) {
            const pin = makeVehiclePin(myVehicle.status, true, true);
            if (myVehMarkerRef.current) {
                myVehMarkerRef.current.position = pos;
                myVehMarkerRef.current.content = pin;
            } else {
                myVehMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
                    position: pos, map: mapRef.current, title: myVehicle.license_plate, content: pin, zIndex: 1000
                });
            }
        }
    } else if (myVehMarkerRef.current) {
        myVehMarkerRef.current.map = null;
        myVehMarkerRef.current = null;
    }

    // Clear old backup markers
    backupMarkersRef.current.forEach(m => { m.map = null; });
    backupMarkersRef.current = [];

    related.forEach(rel => {
      if (!rel.assigned_unit_id) return;
      const v = vehicles.find((veh: any) => veh.id === rel.assigned_unit_id);
      if (!v || !v.latitude || !v.longitude) return;
      const lat = parseFloat(v.latitude);
      const lng = parseFloat(v.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const m = new google.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        map: mapRef.current!,
        title: v.license_plate ?? 'Backup unit',
        content: makeBackupPin(),
        zIndex: 5,
      });
      m.addListener('gmp-click', () => {
        if (mapContainerRef.current && mapRef.current) {
          showInfoPopup(mapContainerRef.current, m, mapRef.current, {
            title: v.license_plate ?? 'Backup unit',
            lines: [
              `Type: ${(v.vehicle_type ?? '').replace(/_/g, ' ') || '—'}`,
              `Status: ${rel.status ?? '—'}`,
            ],
          }, popupRef);
        }
      });
      backupMarkersRef.current.push(m);
    });
  }, [related, vehicles, mapReady, isUnderSimulation, myVehicle]);

  async function handleStatusUpdate(newStatus: 'in_progress' | 'resolved') {
    setError('');
    setActing(true);
    try {
      const updated = await updateIncidentStatus(token, incId, newStatus);
      setIncident(updated.incident ?? updated);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Action failed');
    } finally {
      setActing(false);
    }
  }

  async function handleRequestSupport(type: string) {
    setError('');
    setActing(true);
    setSupportType(null);
    try {
      await requestSupport(token, incId, { support_type: type });
      const rel = await getRelatedIncidents(token, incId);
      setRelated(rel);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not request support');
    } finally {
      setActing(false);
    }
  }

  if (!mounted) return null;
  if (!user || user.role !== 'first_responder') return null;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Spinner />
      </div>
    );
  }

  if (incError) {
    return (
      <div className={styles.body}>
        <ErrorState message={String(incError)} />
        <Button onClick={() => router.back()} style={{ marginTop: '16px' }}>Go back</Button>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className={styles.body}>
        <Text style={{ color: 'var(--color-text-muted)' }}>Incident not found.</Text>
        <Button onClick={() => router.back()} style={{ marginTop: '16px' }}>Go back</Button>
      </div>
    );
  }

  const isResolved = incident.status === 'resolved' || incident.status === 'cancelled';

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <Button appearance="transparent" icon={<ArrowLeftRegular />} onClick={() => router.push('/field')} aria-label="Back" />
        <Text className={styles.topTitle}>{incident.location_name ?? 'Incident'}</Text>
        <IncidentTypeChip type={incident.incident_type} />
      </div>

      {/* Map */}
      <div className={styles.mapBox}>
        {!MAPS_KEY ? (
          <div style={{ padding: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>Map unavailable (no API key).</div>
        ) : (
          <>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            {navInfo && (
              <>
                <div className={styles.navTopBox}>
                  {getManeuverIcon(navInfo.maneuver)}
                  <div style={{ flex: 1 }}>
                    <div className={styles.navMainText}>{navInfo.nextStepDist}</div>
                    <div className={styles.navMainText}>{navInfo.nextStepText}</div>
                  </div>
                </div>
                </>
            )}
            
            {/* Recenter Button */}
            <div 
              style={{ position: 'absolute', bottom: '150px', right: '16px', background: '#fff', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 100, color: '#005953' }}
              onClick={handleRecenter}
            >
              <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><polygon points='3 11 22 2 13 21 11 13 3 11'/></svg>
            </div>
            {/* Map legend */}
            <div className={styles.legend}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: INCIDENT_COLOR[(incident.incident_type ?? '').toLowerCase()] ?? '#888', display: 'inline-block', border: '1.5px solid #fff' }} />
                <span>Incident</span>
              </div>
              {!isUnderSimulation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4285F4', display: 'inline-block', border: '1.5px solid #fff' }} />
                    <span>My location</span>
                </div>
              )}
              {isUnderSimulation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '3px', background: '#FF8C00', display: 'inline-block', border: '1.5px solid #4285F4' }} />
                    <span style={{ fontWeight: 600, color: '#4285F4' }}>YOU (SIM)</span>
                </div>
              )}
              {related.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0097A7', display: 'inline-block', border: '1.5px solid #fff' }} />
                  <span>Backup unit</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Sheet Details */}
      <div className={styles.bottomPanel} style={{ transform: `translateY(${popupOpen ? 0 : 'calc(100% - 140px)'})` }}>
        <div className={styles.dragHandle} onClick={() => setPopupOpen(!popupOpen)} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 16px', borderBottom: popupOpen ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }} onClick={() => setPopupOpen(!popupOpen)}>
          {navInfo ? (
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#b36b00', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {navInfo.duration} <span style={{ color: '#2e7d32' }}>🍃</span>
              </div>
              <div style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                {navInfo.distance} • {(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{incident.status.replace('_', ' ').toUpperCase()}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>Navigating...</div>
            </div>
          )}
          
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ffebeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d32f2f' }}>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><line x1='18' y1='6' x2='6' y2='18'></line><line x1='6' y1='6' x2='18' y2='18'></line></svg>
          </div>
        </div>

        <div className={styles.bodyScroll} style={{ opacity: popupOpen ? 1 : 0, pointerEvents: popupOpen ? 'auto' : 'none', transition: 'opacity 0.2s', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}><IncidentStatusBadge status={incident.status} />
          <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Reported {new Date(incident.created_at).toLocaleTimeString()}
          </Text>
        </div>

        <div className={styles.detailRow}>
          <Text className={styles.label}>Caller</Text>
          <Text className={styles.value}>{incident.citizen_name ?? '—'}</Text>
        </div>

        <div className={styles.detailRow}>
          <Text className={styles.label}>Notes</Text>
          <Text className={styles.value}>{incident.notes ?? '—'}</Text>
        </div>

        {incident.destination_hospital_name && (
          <div className={styles.detailRow}>
            <Text className={styles.label}>Receiving Hospital</Text>
            <Text className={styles.value} style={{ fontWeight: '600', color: 'var(--color-medical)' }}>
              {incident.destination_hospital_name}
            </Text>
          </div>
        )}

        {/* Related / backup incidents */}
        {related.length > 0 && (
          <div className={styles.supportBox}>
            <Text className={styles.supportTitle}>Backup dispatched</Text>
            {related.map((r: any) => {
              const v = vehicles.find((veh: any) => veh.id === r.assigned_unit_id);
              const plate = v?.license_plate ?? null;
              return (
                <Text key={r.id} style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {plate ? `Unit: ${plate}` : 'Unit pending'} · {r.status}
                </Text>
              );
            })}
          </div>
        )}

        {error && <Text className={styles.error}>{error}</Text>}
      </div>

      {/* Action bar */}
      {!isResolved && (
        <div className={styles.actions}>
          {incident.status === 'dispatched' && (
            <Button
              appearance="primary"
              style={{ background: '#000', border: 'none', minHeight: '56px', fontSize: '16px', fontWeight: '700' }}
              disabled={acting}
              onClick={() => {
                setConfirmAction({
                  title: 'Arrive at Scene',
                  content: 'Did you arrive at the incident scene?',
                  action: () => handleStatusUpdate('in_progress')
                });
              }}
            >
              {acting ? <Spinner size="small" /> : 'Slide to Arrive ➔'}
            </Button>
          )}

          {incident.status === 'in_progress' && (
            <>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <Button
                  appearance="secondary"
                  style={{ flex: 1, minHeight: '56px', fontSize: '16px', fontWeight: '700' }}
                  disabled={acting}
                  onClick={() => setSupportType('choose')}
                >
                  Call Backup
                </Button>
                <Button
                  appearance="primary"
                  style={{ flex: 1, background: '#2e7d32', border: 'none', minHeight: '56px', fontSize: '16px', fontWeight: '700' }}
                  disabled={acting}
                  onClick={() => handleStatusUpdate('resolved')}
                >
                {acting ? <Spinner size="small" /> : 'Mark Resolved'}
              </Button>
            </div>
              <Button
                appearance="transparent"
                style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '-4px' }}
                disabled={acting}
                onClick={() => {
                  setConfirmAction({
                  title: 'Undo Arrival',
                  content: 'Revert status back to dispatched?',
                  action: () => handleStatusUpdate('dispatched' as any)
                });
                }}
              >
                Not on scene yet? Undo
              </Button>
            </>
          )}

          {incident.destination_hospital_name && incident.status === 'in_progress' && (
            <Button
              appearance="secondary"
              style={{ width: '100%', minHeight: '48px', fontSize: '15px', borderColor: 'var(--color-medical)', color: 'var(--color-medical)' }}
              disabled={acting}
              onClick={() => {
                if (isUnderSimulation && myVehicle?.id) {
                  setActing(true);
                  setError('');
                  resumeSimulationRun(token, myVehicle.id)
                    .catch((err: any) => setError(err?.response?.data?.message ?? 'Failed to resume simulation'))
                    .finally(() => setActing(false));
                } else {
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(incident.destination_hospital_name)}`, '_blank');
                }
              }}
            >
              Drive to Hospital
            </Button>
          )}

          {(incident.status === 'dispatched' || incident.status === 'in_progress') && (
            <>
              {supportType === null ? (
                <Button
                  appearance="secondary"
                  style={{ minHeight: '56px', fontSize: '15px' }}
                  disabled={acting}
                  onClick={() => setSupportType('choose')}
                >
                  Request backup
                </Button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Text style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Select backup type:</Text>
                  {[
                    { label: 'Ambulance',  value: 'ambulance'  },
                    { label: 'Fire truck', value: 'fire_truck' },
                    { label: 'Police car', value: 'police_car' },
                  ].map(({ label, value }) => (
                    <Button
                      key={value}
                      appearance="secondary"
                      style={{ minHeight: '44px', fontSize: '14px' }}
                      disabled={acting}
                      onClick={() => handleRequestSupport(value)}
                    >
                      {acting ? <Spinner size="small" /> : label}
                    </Button>
                  ))}
                  <Button appearance="transparent" style={{ fontSize: '13px' }} disabled={acting} onClick={() => setSupportType(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isResolved && (
        <div className={styles.actions}>
          <Button style={{ minHeight: '48px' }} onClick={() => router.push('/field')}>
            Back to shift
          </Button>
        </div>
      )}
      </div>

      {supportType === 'choose' && (
        <Dialog open={true} onOpenChange={(e, data) => !data.open && setSupportType(null)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Call for Backup</DialogTitle>
              <DialogContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                  {[
                    { label: 'Ambulance',  value: 'ambulance'  },
                    { label: 'Fire truck', value: 'fire_truck' },
                    { label: 'Police car', value: 'police_car' },
                  ].map(({ label, value }) => (
                    <Button
                      key={value}
                      appearance="secondary"
                      style={{ minHeight: '44px', fontSize: '14px' }}
                      disabled={acting}
                      onClick={() => handleRequestSupport(value)}
                    >
                      {acting ? <Spinner size="small" /> : label}
                    </Button>
                  ))}
                </div>
              </DialogContent>
              <DialogActions>
                <Button appearance='secondary' onClick={(e) => { e.stopPropagation(); setSupportType(null); }}>Cancel</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}

      {confirmAction && (
        <Dialog open={true} onOpenChange={(e, data) => !data.open && setConfirmAction(null)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{confirmAction.title}</DialogTitle>
              <DialogContent>{confirmAction.content}</DialogContent>
              <DialogActions>
                <Button appearance='secondary' onClick={(e) => { e.stopPropagation(); setConfirmAction(null); }}>Cancel</Button>
                <Button appearance='primary' onClick={(e) => { e.stopPropagation(); confirmAction.action(); setConfirmAction(null); }}>Confirm</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}


export default function FieldIncidentPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner /></div>}>
      <FieldIncidentContent />
    </Suspense>
  );
}
