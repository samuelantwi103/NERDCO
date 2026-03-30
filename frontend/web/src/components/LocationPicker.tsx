'use client';
import { useEffect, useRef, useState } from 'react';
import { Spinner, Text, Field, Input } from '@fluentui/react-components';
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
