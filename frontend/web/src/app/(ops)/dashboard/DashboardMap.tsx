'use client';
import { useCallback, useRef, useEffect, useState } from 'react';
import { loadGoogleMaps } from '@/lib/maps/loader';
import { consumeMapLoad } from '@/lib/maps/quota';
import { showInfoPopup, dismissInfoPopup } from '@/lib/maps/infoPopup';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const DEFAULT_CENTER = { lat: 5.6037, lng: -0.1870 }; // Accra

/** Incident type → fill colour */
const INCIDENT_COLOR: Record<string, string> = {
  medical: '#E63946',
  fire:    '#F26419',
  crime:   '#1565C0',
};

/** Vehicle status → fill colour */
const VEHICLE_COLOR: Record<string, string> = {
  available:   '#107C10',
  dispatched:  '#FF8C00',
  unavailable: '#797775',
};

const INCIDENT_ICONS: Record<string, string> = {
  medical: '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM17 13h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>',
  fire: '<path d="M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23-.1-.11-.27-.13-.39-.05-3.35 2.11-4.8 5.76-5.18 9.24C7.72 13.06 7 14.33 7 15.6c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.22-.39-2.36-1.02-3.25zM12 18.5c-1.53 0-2.82-1.09-3.07-2.58.62.9 1.63 1.58 2.82 1.58 1.45 0 2.66-.86 3.12-2.12-.55 1.52-2.02 2.62-3.72 2.62.29-.2.53-.45.74-.75 1.12-1.63.48-4.22.48-4.22.25.79.29 1.62-.06 2.37.59-1.25.29-2.52-.39-3.32-.45.38-.85.83-1.05 1.4-1.29 3.65 1.76 4.67 1.13 5.02z"/>',
  crime: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>'
};

function makeIncidentPin(type: string, isSelected: boolean, childCount: number, isAwaitingUnits: boolean): HTMLElement {
  const color = INCIDENT_COLOR[type] ?? '#888888';
  const size  = isSelected ? 32 : 24;

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:relative;display:flex;align-items:center;justify-content:center;`;

  if (isAwaitingUnits) {
    const pulse = document.createElement('div');
    pulse.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.6;animation:dashmap-hazard-pulse 1.5s ease-out infinite;`;
    wrap.appendChild(pulse);

    if (!document.getElementById('dashmap-hazard-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'dashmap-hazard-pulse-style';
      s.textContent = `@keyframes dashmap-hazard-pulse{0%{transform:scale(1);opacity:0.6}70%{transform:scale(2.5);opacity:0}100%{transform:scale(2.5);opacity:0}}`;
      document.head.appendChild(s);
    }
  }

  const dot = document.createElement('div');
  dot.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};border:${isSelected ? 3 : 2}px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.35);
    transition:width 120ms,height 120ms;
    z-index: 1;
    display:flex;
    align-items:center;
    justify-content:center;
  `;
  
  const iconSvg = INCIDENT_ICONS[type] || '<circle cx="12" cy="12" r="8"/>';
  dot.innerHTML = `<svg width="${size * 0.6}" height="${size * 0.6}" viewBox="0 0 24 24" fill="#fff">${iconSvg}</svg>`;
  
  wrap.appendChild(dot);

  if (childCount > 0) {
    const badge = document.createElement('div');
    badge.style.cssText = `
      position:absolute;top:-6px;right:-8px;
      background:#000;color:#fff;font-size:10px;font-weight:700;
      border-radius:8px;padding:1px 5px;white-space:nowrap;
      border:1.5px solid #fff;pointer-events:none;
    `;
    badge.textContent = `×${childCount + 1}`;
    wrap.appendChild(badge);
  }

  return wrap;
}

function makeVehiclePin(status: string): HTMLElement {
  const color = VEHICLE_COLOR[status] ?? '#797775';
  const el = document.createElement('div');
  el.style.cssText = `
    width:13px;height:13px;border-radius:50%;
    background:${color};border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
  `;
  return el;
}

function makeMyLocationPin(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;`;
  const pulse = document.createElement('div');
  pulse.style.cssText = `position:absolute;width:20px;height:20px;border-radius:50%;background:#4285F4;opacity:0.25;animation:dashmap-pulse 1.8s ease-out infinite;`;
  const dot = document.createElement('div');
  dot.style.cssText = `width:12px;height:12px;border-radius:50%;background:#4285F4;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);z-index:1;`;
  wrap.appendChild(pulse);
  wrap.appendChild(dot);

  // Inject keyframes once
  if (!document.getElementById('dashmap-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'dashmap-pulse-style';
    s.textContent = `@keyframes dashmap-pulse{0%{transform:scale(1);opacity:0.25}70%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}`;
    document.head.appendChild(s);
  }
  return wrap;
}


interface MapProps {
  incidents: any[];
  vehicles: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  myLocation?: { lat: number; lng: number } | null;
  hidePOIs?: boolean;
  enableRouting?: boolean;
}

export const DashboardMap = ({ incidents, vehicles, selectedId, onSelect, myLocation, hidePOIs, enableRouting }: MapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<google.maps.Map | null>(null);
  const incMarkersRef   = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const vehMarkersRef   = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const myLocMarkerRef  = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const polylineRef     = useRef<google.maps.Polyline | null>(null);
  const lastRouteRef    = useRef<{ origin: any, destination: any } | null>(null);

  const popupRef        = useRef<HTMLElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Build child-count index: parentId → count of children
  const childCounts = new Map<string, number>();
  incidents.forEach(i => {
    if (i.parent_incident_id) {
      childCounts.set(i.parent_incident_id, (childCounts.get(i.parent_incident_id) ?? 0) + 1);
    }
  });

  // Only render top-level (non-child) incidents
  const topLevelIncidents = incidents.filter(i => !i.parent_incident_id);

  // Init map
  useEffect(() => {
    if (!MAPS_KEY || !mapContainerRef.current || mapRef.current) return;
    if (!consumeMapLoad()) return;

    loadGoogleMaps(MAPS_KEY).then(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const baseStyles: any[] = hidePOIs ? [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ] : [];

      const map = new google.maps.Map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        mapId: 'DEMO_MAP_ID',
      });

      polylineRef.current = new google.maps.Polyline({
        map,
        path: [],
        geodesic: true,
        strokeColor: '#00BFFF',
        strokeOpacity: 0.8,
        strokeWeight: 5,
        icons: [{
          icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillOpacity: 1, strokeOpacity: 1 },
          offset: '50%'
        }]
      });
      mapRef.current = map;
      setMapReady(true);
    });
  }, [hidePOIs]);

  // Pan to selected incident only when selectedId changes
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Only pan if we just selected this incident (prevents jumping around on background polling updates)
    if (selectedId && selectedId !== prevSelectedIdRef.current) {
      const inc = incidents.find(i => i.id === selectedId || i.parent_incident_id === selectedId);
      if (inc) {
        const lat = parseFloat(inc.latitude);
        const lng = parseFloat(inc.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(14);
        }
      }
      prevSelectedIdRef.current = selectedId;
    } else if (!selectedId && myLocation && prevSelectedIdRef.current !== null) {
      mapRef.current.panTo(myLocation);
      mapRef.current.setZoom(14);
      prevSelectedIdRef.current = null;
    }
  }, [selectedId, incidents, myLocation?.lat, myLocation?.lng]);

  // Render / update incident markers
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;
    const map = mapRef.current;

    // Remove stale markers
    const currentIds = new Set(topLevelIncidents.map(i => i.id));
    incMarkersRef.current.forEach((m, id) => {
      if (!currentIds.has(id)) { m.map = null; incMarkersRef.current.delete(id); }
    });

    topLevelIncidents.forEach(incident => {
      const lat = parseFloat(incident.latitude);
      const lng = parseFloat(incident.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const pos        = { lat, lng };
      const isSelected = incident.id === selectedId;
      const count      = childCounts.get(incident.id) ?? 0;
      const incType    = (incident.incident_type ?? incident.type_id ?? '').toLowerCase();
      const isAwaiting = !incident.assigned_unit_id && incident.status !== 'resolved' && incident.status !== 'closed';
      const pin        = makeIncidentPin(incType, isSelected, count, isAwaiting);

      if (incMarkersRef.current.has(incident.id)) {
        const m = incMarkersRef.current.get(incident.id)!;
        m.position = pos;
        m.content  = makeIncidentPin(incType, isSelected, count, isAwaiting);
      } else {
        const m = new google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map,
          title:   incident.location_name ?? 'Incident',
          content: pin,
        });
        m.addListener('gmp-click', () => {
          onSelect(incident.id);
        });
        incMarkersRef.current.set(incident.id, m);
      }
    });
  }, [topLevelIncidents, selectedId, mapReady, childCounts]);

  // Render / update vehicle markers — when an incident is selected, show only its assigned vehicle
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;
    const map = mapRef.current;

    // Determine which vehicle IDs are linked to the selected incident
    const linkedVehicleIds: Set<string> = new Set();
    if (selectedId) {
      incidents.forEach(i => {
        if ((i.id === selectedId || i.parent_incident_id === selectedId) && i.assigned_vehicle_id) {
          linkedVehicleIds.add(i.assigned_vehicle_id);
        }
      });
    }

    const visibleVehicles = selectedId
      ? vehicles.filter((v: any) => linkedVehicleIds.has(v.id))
      : vehicles;

    const currentIds = new Set(visibleVehicles.map((v: any) => v.id));
    // Hide markers for vehicles not in visibleVehicles
    vehMarkersRef.current.forEach((m, id) => {
      if (!currentIds.has(id)) { m.map = null; vehMarkersRef.current.delete(id); }
    });

    visibleVehicles.forEach((v: any) => {
      const lat = parseFloat(v.latitude);
      const lng = parseFloat(v.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const pos = { lat, lng };
      const pin = makeVehiclePin(v.status);

      if (vehMarkersRef.current.has(v.id)) {
        const m = vehMarkersRef.current.get(v.id)!;
        m.position = pos;
        m.content  = makeVehiclePin(v.status);
      } else {
        const m = new google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map,
          title:   v.license_plate ?? 'Vehicle',
          content: pin,
          zIndex:  5,
        });
        m.addListener('gmp-click', () => {
          if (mapContainerRef.current) {
            const toTitle = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
            const relativeTime = (iso: string) => {
              const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
              if (diff < 60) return `${diff}s ago`;
              if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
              return `${Math.floor(diff / 3600)}h ago`;
            };
            showInfoPopup(mapContainerRef.current, m, map, {
              title: v.license_plate ?? 'Vehicle',
              lines: [
                `Type: ${(v.vehicle_type ?? '').replace(/_/g, ' ') || '—'}`,
                `Status: ${toTitle(v.status ?? '')}`,
                ...(v.last_updated ? [`Last GPS update: ${relativeTime(v.last_updated)}`] : []),
              ],
            }, popupRef);
          }
        });
        vehMarkersRef.current.set(v.id, m);
      }
    });
  }, [vehicles, incidents, selectedId, mapReady]);

  // My location marker
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;
    if (!myLocation) return;

    if (myLocMarkerRef.current) {
      myLocMarkerRef.current.position = myLocation;
    } else {
      myLocMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        position: myLocation,
        map: mapRef.current,
        title: 'My location',
        content: makeMyLocationPin(),
        zIndex: 999,
      });
    }
  }, [myLocation, mapReady]);
    // Handle direct line "Routing" for field responders (Demo mode fallback)
  useEffect(() => {
    if (!mapReady || !enableRouting || !polylineRef.current) return;

    if (!myLocation || !selectedId) {
      polylineRef.current.setPath([]); 
      lastRouteRef.current = null;
      return;
    }

    const t = incidents.find(i => i.id === selectedId);
    if (!t || !t.latitude || !t.longitude) return;

    const dest = { lat: parseFloat(t.latitude), lng: parseFloat(t.longitude) };
    if (isNaN(dest.lat) || isNaN(dest.lng)) return;

    // Draw a direct path
    polylineRef.current.setPath([myLocation, dest]);
  }, [myLocation, selectedId, enableRouting, mapReady, incidents]);
  return (
    <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%', zIndex: 0 }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '16px',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '8px', padding: '8px 12px',
        fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10,
        color: 'var(--color-text)'
      }}>
        <span style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px', color: 'var(--color-text-muted)' }}>Legend</span>
        {[
          { color: '#E63946', label: 'Medical' },
          { color: '#F26419', label: 'Fire' },
          { color: '#1565C0', label: 'Crime' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', border: '1.5px solid var(--color-bg)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            <span>{label}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '2px', paddingTop: '4px' }}>
          {[
            { color: '#107C10', label: 'Available' },
            { color: '#FF8C00', label: 'Dispatched' },
            { color: '#797775', label: 'Unavailable' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', border: '1.5px solid var(--color-bg)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
