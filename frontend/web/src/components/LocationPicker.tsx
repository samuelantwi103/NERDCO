'use client';
import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Spinner, Text, Field, Input } from '@fluentui/react-components';
import { SearchRegular, DismissRegular } from '@fluentui/react-icons';
import { loadGoogleMaps } from '@/lib/maps/loader';
import { consumeMapLoad, consumeGeocode } from '@/lib/maps/quota';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface PickedLocation {
  lat:  number;
  lng:  number;
  name: string;
}

interface Props {
  value:    PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  height?:  string;
  defaultCenter?: { lat: number; lng: number };
}

/**
 * Google Maps location picker with a no-API-key fallback.
 * Click anywhere on the map to drop a pin; reverse-geocodes via
 * the Google Geocoding API (quota-guarded).
 * When NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set, shows manual lat/lng inputs.
 */
export function LocationPicker({ value, onChange, height = '400px', defaultCenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const markerRef    = useRef<google.maps.Marker | null>(null);

  const [mapReady,    setMapReady]    = useState(false);
  const [manualLat,   setManualLat]   = useState(value ? String(value.lat) : '');
  const [manualLng,   setManualLng]   = useState(value ? String(value.lng) : '');
  const [manualName,  setManualName]  = useState(value?.name ?? '');
  const [coordError,  setCoordError]  = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searching,   setSearching]   = useState(false);

  const useMap = useRef(!!(MAPS_KEY && consumeMapLoad())).current;

  // ── Google Maps init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!useMap || !containerRef.current) return;
    const center = defaultCenter ?? value ?? { lat: 5.614818, lng: -0.205874 };

    loadGoogleMaps(MAPS_KEY!).then(() => {
      if (!containerRef.current || mapRef.current) return;

      const map = new google.maps.Map(containerRef.current, {
        center,
        zoom: 13,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });

      if (value) {
        markerRef.current = new google.maps.Marker({ position: value, map });
      }

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        const pos = e.latLng;
        if (!pos) return;
        const lat = pos.lat();
        const lng = pos.lng();

        if (markerRef.current) {
          markerRef.current.setPosition(pos);
        } else {
          markerRef.current = new google.maps.Marker({ position: pos, map });
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          setCoordError('Coordinates out of range: lat must be -90..90, lng must be -180..180');
          return;
        }
        setCoordError('');
        const coordName = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onChange({ lat, lng, name: coordName });

        if (consumeGeocode()) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results?.[0]) {
              onChange({ lat, lng, name: results[0].formatted_address });
            }
          });
        }
      });

      mapRef.current = map;
      // Trigger resize after paint so the map fills its container (handles dynamic height)
      requestAnimationFrame(() => {
        google.maps.event.trigger(map, 'resize');
        map.setCenter(center);
      });
      setMapReady(true);
    }).catch(() => {});

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker in sync when value changes externally
  useEffect(() => {
    if (!mapRef.current || !value) return;
    const pos = { lat: value.lat, lng: value.lng };
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      markerRef.current = new google.maps.Marker({ position: pos, map: mapRef.current });
    }
  }, [value?.lat, value?.lng]);

  // ── Manual fallback ───────────────────────────────────────────────────────
  useEffect(() => {
    if (useMap) return;
    const la = parseFloat(manualLat);
    const lo = parseFloat(manualLng);
    if (!isNaN(la) && !isNaN(lo)) {
      if (la < -90 || la > 90 || lo < -180 || lo > 180) {
        setCoordError('Coordinates out of range: lat must be -90..90, lng must be -180..180');
        return;
      }
      setCoordError('');
      onChange({ lat: la, lng: lo, name: manualName || `${la.toFixed(6)}, ${lo.toFixed(6)}` });
    } else {
      setCoordError('');
    }
  }, [manualLat, manualLng, manualName]);

  function handleSearch() {
    const q = searchQuery.trim();
    if (!q || !mapRef.current) return;
    setSearching(true);
    setSearchError('');
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: q }, (results, status) => {
      setSearching(false);
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location;
        mapRef.current!.panTo(loc);
        mapRef.current!.setZoom(15);
      } else {
        setSearchError('Location not found — try a more specific name.');
      }
    });
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
  }

  if (!useMap) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="Latitude" required>
            <Input
              type="number"
              step="any"
              value={manualLat}
              onChange={e => setManualLat(e.target.value)}
              placeholder="e.g. 5.614818"
            />
          </Field>
          <Field label="Longitude" required>
            <Input
              type="number"
              step="any"
              value={manualLng}
              onChange={e => setManualLng(e.target.value)}
              placeholder="e.g. -0.205874"
            />
          </Field>
        </div>
        {coordError && (
          <Text style={{ color: 'var(--color-text-error, #D13438)', fontSize: '12px' }}>{coordError}</Text>
        )}
        <Field label="Location name">
          <Input
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            placeholder="e.g. Makola Market, Accra"
          />
        </Field>
        <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          No Google Maps API key — enter coordinates manually.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: height, minHeight: '300px' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Search bar overlay */}
        {mapReady && (
          <div style={{
            position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, width: 'min(420px, calc(100% - 24px))',
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0',
              background: 'rgba(255,255,255,0.97)', borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.18)', overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search area (e.g. Kaneshie, Tema…)"
                style={{
                  flex: 1, border: 'none', outline: 'none', padding: '9px 12px',
                  fontSize: '13px', background: 'transparent', color: 'var(--color-text)',
                  fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchError(''); }}
                  style={{ background: 'none', border: 'none', padding: '8px 4px', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center' }}
                  title="Clear"
                >
                  <DismissRegular fontSize={14} />
                </button>
              )}
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
                style={{
                  background: 'var(--gray-950, #141414)', border: 'none', padding: '0 14px',
                  height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  color: '#fff', borderRadius: '0', flexShrink: 0,
                }}
                title="Search"
              >
                {searching ? <Spinner size="extra-tiny" /> : <SearchRegular fontSize={15} />}
              </button>
            </div>
            {searchError && (
              <div style={{
                background: 'rgba(255,255,255,0.95)', borderRadius: '6px', padding: '6px 10px',
                fontSize: '12px', color: 'var(--color-fire, #D13438)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}>
                {searchError}
              </div>
            )}
          </div>
        )}

        {!mapReady && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-bg)', gap: '8px',
          }}>
            <Spinner size="small" />
            <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Loading map…</Text>
          </div>
        )}
        {mapReady && !value && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)', color: '#fff',
            fontSize: '11px', padding: '4px 10px', borderRadius: '12px',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            Click to drop a pin
          </div>
        )}
      </div>
      {coordError && (
        <Text style={{ color: 'var(--color-text-error, #D13438)', fontSize: '12px' }}>{coordError}</Text>
      )}
    </div>
  );
}
