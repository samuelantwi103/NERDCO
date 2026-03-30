'use client';
import { useRef, useEffect, useState } from 'react';
import { Text, makeStyles } from '@fluentui/react-components';
import { useAuth } from '@/lib/context/AuthContext';
import { loadGoogleMaps } from '@/lib/maps/loader';
import { consumeMapLoad } from '@/lib/maps/quota';
import { showInfoPopup, dismissInfoPopup } from '@/lib/maps/infoPopup';
import { useVehicleMap } from './useVehicleMap';
import { VehicleSidebar } from './VehicleSidebar';
import { ConnectionBanner } from '@/components/ConnectionBanner';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const STATUS_COLOR: Record<string, string> = {
  available:   'var(--color-available)',
  dispatched:  'var(--color-dispatched)',
  unavailable: 'var(--color-unavailable)',
};

const useStyles = makeStyles({
  page: { display: 'flex', height: '100%', overflow: 'hidden' },
  legend: {
    position: 'absolute',
    bottom: '24px',
    right: '16px',
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '12px',
    zIndex: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  legendRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  dot: { width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0 },
});

export default function VehiclesMapPage() {
  const styles  = useStyles();
  const { user } = useAuth();
  const token   = user?.access_token ?? '';

  const { state, actions } = useVehicleMap(token);
  const { vehicles, loading, selected, wsStatus } = state;

  const mapRef      = useRef<HTMLDivElement>(null);
  const mapObj      = useRef<google.maps.Map | null>(null);
  const markersRef  = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const popupRef    = useRef<HTMLElement | null>(null);

  const [mapReady, setMapReady] = useState(false);

  // Init Google Map
  useEffect(() => {
    if (!MAPS_KEY || !mapRef.current || mapObj.current) return;
    if (!consumeMapLoad()) return;

    loadGoogleMaps(MAPS_KEY).then(() => {
      if (!mapRef.current || mapObj.current) return;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 5.614818, lng: -0.205874 },
        zoom: 13,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        zoomControl: true,
      });
      map.addListener('click', () => dismissInfoPopup(popupRef));
      mapObj.current = map;
      setMapReady(true);
    }).catch(() => {});
  }, []);

  // Add / update markers when vehicles change
  useEffect(() => {
    if (!mapObj.current || !window.google) return;
    vehicles.forEach(v => {
      if (!v.latitude || !v.longitude) return;
      const pos   = { lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) };
      const color = STATUS_COLOR[v.status] ?? '#797775';
      
      const pin = document.createElement('div');
      pin.style.width = '18px';
      pin.style.height = '18px';
      pin.style.borderRadius = '50%';
      pin.style.backgroundColor = color;
      pin.style.border = '2px solid white';
      pin.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

      if (markersRef.current.has(v.id)) {
        const m = markersRef.current.get(v.id)!;
        (m as any).position = pos;
        if (m.content instanceof HTMLElement) {
          m.content.style.backgroundColor = color;
        }
      } else {
        const m = new window.google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map: mapObj.current!,
          title: v.license_plate,
          content: pin,
        }) as any;
        m.addListener('gmp-click', () => {
          actions.setSelected(v.id);
          if (mapRef.current && mapObj.current) {
            const toTitle = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
            const relativeTime = (iso: string) => {
              const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
              if (diff < 60) return `${diff}s ago`;
              if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
              return `${Math.floor(diff / 3600)}h ago`;
            };
            showInfoPopup(mapRef.current, m, mapObj.current, {
              title: v.license_plate ?? 'Vehicle',
              lines: [
                `Type: ${(v.vehicle_type ?? '').replace(/_/g, ' ') || '—'}`,
                `Status: ${toTitle(v.status ?? '')}`,
                ...(v.driver_name ? [`Driver: ${v.driver_name}`] : []),
                ...(v.last_updated ? [`Last GPS update: ${relativeTime(v.last_updated)}`] : []),
              ],
            }, popupRef);
          }
        });
        markersRef.current.set(v.id, m);
      }
    });
  }, [vehicles, mapReady]);

  function panTo(v: any) {
    if (!mapObj.current || !v.latitude) return;
    mapObj.current.panTo({ lat: parseFloat(v.latitude), lng: parseFloat(v.longitude) });
    mapObj.current.setZoom(15);
    actions.setSelected(v.id);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ConnectionBanner status={wsStatus} />
      <div className={styles.page}>
      <VehicleSidebar
        vehicles={vehicles}
        loading={loading}
        selected={selected}
        onVehicleClick={panTo}
        onVehicleUpdated={actions.fetchVehicles}
      />

      {/* Right: map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }}>
          {!MAPS_KEY && (
            <div style={{ padding: '32px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> to enable the map.
            </div>
          )}
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <Text style={{ fontWeight: '600', fontSize: '11px', marginBottom: '2px' }}>Status</Text>
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} className={styles.legendRow}>
              <span className={styles.dot} style={{ background: c }} />
              <span style={{ textTransform: 'capitalize' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
