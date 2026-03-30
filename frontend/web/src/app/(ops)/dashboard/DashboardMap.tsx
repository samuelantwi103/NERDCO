'use client';
import { useCallback, useRef, useEffect, useState } from 'react';
import { loadGoogleMaps } from '@/lib/maps/loader';
import { consumeMapLoad } from '@/lib/maps/quota';
import { showInfoPopup, dismissInfoPopup } from '@/lib/maps/infoPopup';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const DEFAULT_CENTER = { lat: 5.6037, lng: -0.1870 }; // Accra

/** NAPSG colours */
const INCIDENT_COLOR: Record<string, string> = {
  medical: '#E63946',
  fire:    '#F26419',
  crime:   '#1565C0',
  robbery: '#1565C0',
};
const VEHICLE_COLOR: Record<string, string> = {
  available:   '#107C10',
  dispatched:  '#FF8C00',
  unavailable: '#797775',
};
const FACILITY_COLOR: Record<string, string> = {
  hospital:          '#E63946',
  ambulance_service: '#E63946',
  police_station:    '#1565C0',
  fire_station:      '#F26419',
};

// ── SVG icon paths ────────────────────────────────────────────────────────
const INCIDENT_ICON: Record<string, string> = {
  medical: '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM17 13h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>',
  fire:    '<path d="M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23-.1-.11-.27-.13-.39-.05-3.35 2.11-4.8 5.76-5.18 9.24C7.72 13.06 7 14.33 7 15.6c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.22-.39-2.36-1.02-3.25z"/>',
  crime:   '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>',
  robbery: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>',
};
const FACILITY_ICON: Record<string, string> = {
  hospital:          '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM17 13h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>',
  ambulance_service: '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM17 13h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>',
  police_station:    '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>',
  fire_station:      '<path d="M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23-.1-.11-.27-.13-.39-.05-3.35 2.11-4.8 5.76-5.18 9.24C7.72 13.06 7 14.33 7 15.6c0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.22-.39-2.36-1.02-3.25z"/>',
};

// ── Pin builders ─────────────────────────────────────────────────────────

/** Large teardrop-shaped incident pin */
function makeIncidentPin(type: string, isSelected: boolean, childCount: number, isAwaiting: boolean): HTMLElement {
  const color    = INCIDENT_COLOR[type] ?? '#888';
  const bodySize = isSelected ? 52 : 40;
  const spikeH   = isSelected ? 14 : 10;
  const iconSize = bodySize * 0.55;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;';

  if (isAwaiting) {
    const pulse = document.createElement('div');
    pulse.style.cssText = `position:absolute;top:0;width:${bodySize}px;height:${bodySize}px;border-radius:50%;background:${color};opacity:0.5;animation:dashmap-hazard-pulse 1.4s ease-out infinite;`;
    wrap.appendChild(pulse);
    if (!document.getElementById('dashmap-hazard-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'dashmap-hazard-pulse-style';
      s.textContent = `@keyframes dashmap-hazard-pulse{0%{transform:scale(1);opacity:0.5}70%{transform:scale(2.6);opacity:0}100%{transform:scale(2.6);opacity:0}}`;
      document.head.appendChild(s);
    }
  }

  const body = document.createElement('div');
  body.style.cssText = `
    width:${bodySize}px;height:${bodySize}px;border-radius:50%;
    background:${color};
    border:${isSelected ? 4 : 3}px solid #fff;
    box-shadow:0 3px 10px rgba(0,0,0,0.5),0 0 0 ${isSelected ? 3 : 0}px ${color}66;
    display:flex;align-items:center;justify-content:center;
    z-index:1;position:relative;
    transition:width 120ms,height 120ms;
  `;
  const iconSvg = INCIDENT_ICON[type] ?? '<circle cx="12" cy="12" r="8"/>';
  body.innerHTML = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="#fff" style="filter:drop-shadow(0 1px 1px rgba(0,0,0,0.3))">${iconSvg}</svg>`;
  wrap.appendChild(body);

  // Spike
  const spike = document.createElement('div');
  spike.style.cssText = `
    width:0;height:0;
    border-left:${Math.round(bodySize * 0.18)}px solid transparent;
    border-right:${Math.round(bodySize * 0.18)}px solid transparent;
    border-top:${spikeH}px solid ${color};
    margin-top:-2px;
  `;
  wrap.appendChild(spike);

  if (childCount > 0) {
    const badge = document.createElement('div');
    badge.style.cssText = `
      position:absolute;top:-4px;right:-6px;
      background:#000;color:#fff;font-size:11px;font-weight:800;
      border-radius:10px;padding:2px 6px;white-space:nowrap;
      border:2px solid #fff;pointer-events:none;z-index:2;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    `;
    badge.textContent = `×${childCount + 1}`;
    wrap.appendChild(badge);
  }
  return wrap;
}

/** Vehicle pin — coloured square badge with car icon */
function makeVehiclePin(status: string, isLinked = false): HTMLElement {
  const color = VEHICLE_COLOR[status] ?? '#797775';
  const size  = isLinked ? 30 : 22;
  const el = document.createElement('div');
  el.style.cssText = `
    width:${size}px;height:${size}px;border-radius:6px;
    background:${color};
    border:${isLinked ? 3 : 2}px solid #fff;
    box-shadow:0 2px 7px rgba(0,0,0,0.45)${isLinked ? ',0 0 0 2px ' + color + '88' : ''};
    display:flex;align-items:center;justify-content:center;
  `;
  const iconSize = Math.round(size * 0.65);
  el.innerHTML = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="#fff"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;
  return el;
}

/** Facility pin — large square with icon + label */
function makeFacilityPin(type: string, name: string, isMyFacility: boolean): HTMLElement {
  const color   = FACILITY_COLOR[type] ?? '#555';
  const size    = isMyFacility ? 48 : 40;
  const iconSvg = FACILITY_ICON[type] ?? '<circle cx="12" cy="12" r="8"/>';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';

  const body = document.createElement('div');
  body.style.cssText = `
    width:${size}px;height:${size}px;border-radius:10px;
    background:${color};
    border:${isMyFacility ? 4 : 3}px solid #fff;
    box-shadow:0 3px 12px rgba(0,0,0,0.55)${isMyFacility ? ',0 0 0 3px ' + color + '66' : ''};
    display:flex;align-items:center;justify-content:center;
  `;
  const iconSize = Math.round(size * 0.55);
  body.innerHTML = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="#fff" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))">${iconSvg}</svg>`;
  wrap.appendChild(body);

  // Label below pin
  const lbl = document.createElement('div');
  lbl.style.cssText = `
    background:rgba(0,0,0,0.75);color:#fff;
    font-size:10px;font-weight:700;padding:2px 6px;
    border-radius:4px;white-space:nowrap;max-width:120px;
    overflow:hidden;text-overflow:ellipsis;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
  `;
  lbl.textContent = name;
  wrap.appendChild(lbl);
  return wrap;
}

function makeMyLocationPin(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;';
  const pulse = document.createElement('div');
  pulse.style.cssText = 'position:absolute;width:20px;height:20px;border-radius:50%;background:#4285F4;opacity:0.25;animation:dashmap-pulse 1.8s ease-out infinite;';
  const dot   = document.createElement('div');
  dot.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#4285F4;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);z-index:1;';
  wrap.appendChild(pulse);
  wrap.appendChild(dot);
  if (!document.getElementById('dashmap-pulse-style')) {
    const s = document.createElement('style'); s.id = 'dashmap-pulse-style';
    s.textContent = '@keyframes dashmap-pulse{0%{transform:scale(1);opacity:0.25}70%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}';
    document.head.appendChild(s);
  }
  return wrap;
}

// ── Types ─────────────────────────────────────────────────────────────────
export interface Facility {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: string;
  isMyFacility?: boolean; // highlight if it's the logged-in user's org
}

interface MapProps {
  incidents:    any[];
  vehicles:     any[];
  selectedId:   string | null;
  onSelect:     (id: string) => void;
  facilities?:  Facility[];
  myLocation?:  { lat: number; lng: number } | null;
  hidePOIs?:    boolean;
  enableRouting?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────
export const DashboardMap = ({
  incidents, vehicles, selectedId, onSelect,
  facilities = [], myLocation, hidePOIs, enableRouting,
}: MapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<google.maps.Map | null>(null);
  const incMarkersRef   = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const vehMarkersRef   = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const facMarkersRef   = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const myLocMarkerRef  = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const fieldPolyRef    = useRef<google.maps.Polyline | null>(null);
  const routeLinesRef   = useRef<google.maps.Polyline[]>([]);
  const popupRef        = useRef<HTMLElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Child-count index
  const childCounts = new Map<string, number>();
  incidents.forEach(i => {
    if (i.parent_incident_id) childCounts.set(i.parent_incident_id, (childCounts.get(i.parent_incident_id) ?? 0) + 1);
  });
  const topLevelIncidents = incidents.filter(i => !i.parent_incident_id || !incidents.some(p => p.id === i.parent_incident_id));

  // ── Init map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!MAPS_KEY || !mapContainerRef.current || mapRef.current) return;
    if (!consumeMapLoad()) return;
    loadGoogleMaps(MAPS_KEY).then(() => {
      if (!mapContainerRef.current || mapRef.current) return;
      const map = new google.maps.Map(mapContainerRef.current, {
        center: DEFAULT_CENTER, zoom: 12,
        disableDefaultUI: true, zoomControl: true,
        mapId: 'DEMO_MAP_ID',
        ...(hidePOIs ? {
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ]
        } : {}),
      });
      // Field-view routing polyline
      fieldPolyRef.current = new google.maps.Polyline({
        map, path: [], geodesic: true,
        strokeColor: '#00BFFF', strokeOpacity: 0.85, strokeWeight: 5,
        icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillOpacity: 1, strokeOpacity: 1 }, offset: '50%' }],
      });
      mapRef.current = map;
      setMapReady(true);
    });
  }, [hidePOIs]);

  // ── Pan to selected incident ──────────────────────────────────────────
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedId && selectedId !== prevSelectedIdRef.current) {
      const inc = incidents.find(i => i.id === selectedId || i.parent_incident_id === selectedId);
      if (inc) {
        const lat = parseFloat(inc.latitude); const lng = parseFloat(inc.longitude);
        if (!isNaN(lat) && !isNaN(lng)) { mapRef.current.panTo({ lat, lng }); mapRef.current.setZoom(14); }
      }
      prevSelectedIdRef.current = selectedId;
    } else if (!selectedId && myLocation && prevSelectedIdRef.current !== null) {
      mapRef.current.panTo(myLocation); mapRef.current.setZoom(14);
      prevSelectedIdRef.current = null;
    }
  }, [selectedId, incidents, myLocation?.lat, myLocation?.lng]);

  // ── Incident markers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;
    const map = mapRef.current;
    const currentIds = new Set(topLevelIncidents.map(i => i.id));
    incMarkersRef.current.forEach((m, id) => { if (!currentIds.has(id)) { m.map = null; incMarkersRef.current.delete(id); } });

    topLevelIncidents.forEach(incident => {
      const lat = parseFloat(incident.latitude); const lng = parseFloat(incident.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const pos        = { lat, lng };
      const isSelected = incident.id === selectedId;
      const count      = childCounts.get(incident.id) ?? 0;
      const incType    = (incident.incident_type ?? incident.type_id ?? '').toLowerCase();
      const isAwaiting = !incident.assigned_unit_id && incident.status !== 'resolved' && incident.status !== 'closed';
      const pin        = makeIncidentPin(incType, isSelected, count, isAwaiting);

      if (incMarkersRef.current.has(incident.id)) {
        const m = incMarkersRef.current.get(incident.id)!;
        m.position = pos; m.content = makeIncidentPin(incType, isSelected, count, isAwaiting);
        (m as any).zIndex = isSelected ? 100 : 10;
      } else {
        const m = new google.maps.marker.AdvancedMarkerElement({ position: pos, map, title: incident.location_name ?? 'Incident', content: pin, zIndex: isSelected ? 100 : 10 });
        m.addListener('gmp-click', () => {
          if (mapContainerRef.current) {
            const toTitle = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : '—';
            showInfoPopup(mapContainerRef.current, m, map, {
              title: incident.location_name ?? 'Incident',
              lines: [
                `Type: ${toTitle(incType)}`,
                `Status: ${toTitle(incident.status ?? '')}`,
                ...(incident.citizen_name ? [`Caller: ${incident.citizen_name}`] : []),
                ...(incident.updated_at ? [`Updated: ${relativeTime(incident.updated_at)}`] : []),
              ],
            }, popupRef);
          }
          onSelect(incident.id);
        });
        incMarkersRef.current.set(incident.id, m);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLevelIncidents, selectedId, mapReady]);

  // ── Vehicle markers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;
    const map = mapRef.current;

    const linkedIds = new Set<string>();
    if (selectedId) {
      incidents.forEach(i => {
        const vid = i.assigned_unit_id || i.assigned_vehicle_id;
        if ((i.id === selectedId || i.parent_incident_id === selectedId) && vid) linkedIds.add(vid);
      });
    }

    const visibleVehicles = selectedId ? vehicles.filter(v => linkedIds.has(v.id)) : vehicles;
    const currentIds = new Set(visibleVehicles.map(v => v.id));
    vehMarkersRef.current.forEach((m, id) => { if (!currentIds.has(id)) { m.map = null; vehMarkersRef.current.delete(id); } });

    visibleVehicles.forEach((v: any) => {
      const lat = parseFloat(v.latitude); const lng = parseFloat(v.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const pos      = { lat, lng };
      const isLinked = linkedIds.has(v.id);
      if (vehMarkersRef.current.has(v.id)) {
        const m = vehMarkersRef.current.get(v.id)!;
        m.position = pos; m.content = makeVehiclePin(v.status, isLinked);
        (m as any).zIndex = isLinked ? 50 : 5;
      } else {
        const pin = makeVehiclePin(v.status, isLinked);
        const m   = new google.maps.marker.AdvancedMarkerElement({ position: pos, map, title: v.license_plate ?? 'Vehicle', content: pin, zIndex: isLinked ? 50 : 5 });
        m.addListener('gmp-click', () => {
          if (mapContainerRef.current) {
            showInfoPopup(mapContainerRef.current, m, map, {
              title: v.license_plate ?? 'Vehicle',
              lines: [
                `Type: ${(v.vehicle_type ?? '').replace(/_/g, ' ') || '—'}`,
                `Status: ${v.status ? v.status[0].toUpperCase() + v.status.slice(1) : '—'}`,
                ...(v.last_updated ? [`Last GPS update: ${relativeTime(v.last_updated)}`] : []),
              ],
            }, popupRef);
          }
        });
        vehMarkersRef.current.set(v.id, m);
      }
    });
  }, [vehicles, incidents, selectedId, mapReady]);

  // ── Facility markers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;
    const map = mapRef.current;
    const currentIds = new Set(facilities.map(f => f.id));
    facMarkersRef.current.forEach((m, id) => { if (!currentIds.has(id)) { m.map = null; facMarkersRef.current.delete(id); } });

    facilities.forEach(f => {
      const lat = parseFloat(String(f.lat)); const lng = parseFloat(String(f.lng));
      if (isNaN(lat) || isNaN(lng)) return;
      const pin = makeFacilityPin(f.type, f.name, !!f.isMyFacility);
      if (facMarkersRef.current.has(f.id)) {
        const m = facMarkersRef.current.get(f.id)!;
        m.position = { lat, lng }; m.content = pin;
      } else {
        const m = new google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng }, map, title: f.name, content: pin, zIndex: f.isMyFacility ? 200 : 20,
        });
        m.addListener('gmp-click', () => {
          if (mapContainerRef.current) {
            showInfoPopup(mapContainerRef.current, m, map, {
              title: f.name,
              lines: [`Type: ${f.type.replace(/_/g, ' ')}`],
            }, popupRef);
          }
        });
        facMarkersRef.current.set(f.id, m);
      }
    });
  }, [facilities, mapReady]);

  // ── Route lines for selected incident ────────────────────────────────
  // Draws:  vehicle → incident  (blue dashed)  when en-route
  //         incident → hospital (green solid)   when transporting
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    // Clear previous route lines
    routeLinesRef.current.forEach(l => l.setMap(null));
    routeLinesRef.current = [];

    if (!selectedId) return;

    const selectedInc = incidents.find(i => i.id === selectedId);
    if (!selectedInc) return;
    const incLat = parseFloat(selectedInc.latitude);
    const incLng = parseFloat(selectedInc.longitude);
    if (isNaN(incLat) || isNaN(incLng)) return;

    const map = mapRef.current;

    // All incidents in the group (parent + children)
    const groupIncidents = incidents.filter(i => i.id === selectedId || i.parent_incident_id === selectedId);

    groupIncidents.forEach(inc => {
      const vid = inc.assigned_unit_id || inc.assigned_vehicle_id;
      if (!vid) return;
      const vehicle = vehicles.find(v => v.id === vid);
      if (!vehicle) return;
      const vLat = parseFloat(vehicle.latitude); const vLng = parseFloat(vehicle.longitude);
      if (isNaN(vLat) || isNaN(vLng)) return;

      const status = inc.status;
      const isEnRoute  = status === 'dispatched';
      const isOnSiteOrTransport = status === 'in_progress';

      if (isEnRoute) {
        // Blue dashed line: vehicle → incident
        const line = new google.maps.Polyline({
          map,
          path: [{ lat: vLat, lng: vLng }, { lat: incLat, lng: incLng }],
          geodesic: true,
          strokeColor: '#0078D4',
          strokeOpacity: 0,
          strokeWeight: 3,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, scale: 4 },
            offset: '0', repeat: '16px',
          }],
        });
        routeLinesRef.current.push(line);
      }

      if (isOnSiteOrTransport) {
        // Grey dashed line: vehicle → incident (already arrived)
        const line1 = new google.maps.Polyline({
          map,
          path: [{ lat: vLat, lng: vLng }, { lat: incLat, lng: incLng }],
          geodesic: true, strokeColor: '#797775', strokeOpacity: 0.5, strokeWeight: 2,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 }, offset: '0', repeat: '12px' }],
        });
        routeLinesRef.current.push(line1);
      }

      // Green solid line: incident → hospital (if hospital assigned)
      if (inc.destination_hospital_id) {
        const hospital = facilities.find(f => f.id === inc.destination_hospital_id);
        if (hospital) {
          const hLat = parseFloat(String(hospital.lat)); const hLng = parseFloat(String(hospital.lng));
          if (!isNaN(hLat) && !isNaN(hLng)) {
            const line2 = new google.maps.Polyline({
              map,
              path: [{ lat: incLat, lng: incLng }, { lat: hLat, lng: hLng }],
              geodesic: true, strokeColor: '#107C10', strokeOpacity: 0.9, strokeWeight: 4,
              icons: [{
                icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillOpacity: 1, strokeOpacity: 1 },
                offset: '60%',
              }],
            });
            routeLinesRef.current.push(line2);
          }
        }
      }
    });
  }, [selectedId, incidents, vehicles, facilities, mapReady]);

  // ── My location marker ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker || !myLocation) return;
    if (myLocMarkerRef.current) {
      myLocMarkerRef.current.position = myLocation;
    } else {
      myLocMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        position: myLocation, map: mapRef.current, title: 'My location', content: makeMyLocationPin(), zIndex: 999,
      });
    }
  }, [myLocation, mapReady]);

  // ── Field-responder direct routing (enableRouting) ────────────────────
  useEffect(() => {
    if (!mapReady || !enableRouting || !fieldPolyRef.current) return;
    if (!myLocation || !selectedId) { fieldPolyRef.current.setPath([]); return; }
    const t = incidents.find(i => i.id === selectedId);
    if (!t || !t.latitude || !t.longitude) return;
    const dest = { lat: parseFloat(t.latitude), lng: parseFloat(t.longitude) };
    if (isNaN(dest.lat) || isNaN(dest.lng)) return;
    fieldPolyRef.current.setPath([myLocation, dest]);
  }, [myLocation, selectedId, enableRouting, mapReady, incidents]);

  // ── Render ────────────────────────────────────────────────────────────
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
        color: 'var(--color-text)',
      }}>
        <span style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px', color: 'var(--color-text-muted)' }}>Legend</span>
        {[
          { color: '#E63946', label: 'Medical' },
          { color: '#F26419', label: 'Fire' },
          { color: '#1565C0', label: 'Crime / Police' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', border: '2px solid var(--color-bg)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
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
              <span style={{ width: 8, height: 8, borderRadius: '3px', background: color, display: 'inline-block', border: '1.5px solid var(--color-bg)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
        {selectedId && (
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '2px', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 22, height: 3, background: '#0078D4', display: 'inline-block', borderTop: '3px dashed #0078D4' }} />
              <span style={{ color: 'var(--color-text-secondary)' }}>En route</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 22, height: 3, background: '#107C10', display: 'inline-block' }} />
              <span style={{ color: 'var(--color-text-secondary)' }}>To hospital</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
