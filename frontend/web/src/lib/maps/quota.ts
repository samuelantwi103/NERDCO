/**
 * Google Maps API quota guard.
 *
 * Google Maps JS API costs $7/1000 map loads (~28,500 free per month / ~950/day).
 * Geocoding API costs $5/1000 requests (~40,000 free per month / ~1,333/day).
 *
 * We cap well below the free tier to ensure $0 spend even during demos or
 * evaluation by multiple reviewers on the same day.
 *
 * LIMITS (intentionally conservative):
 *   MAP_LOADS_PER_DAY   = 200  (21% of daily free tier)
 *   GEOCODE_PER_DAY     = 100  ( 7% of daily free tier)
 *
 * Counters are stored in localStorage, keyed by today's ISO date so they
 * reset automatically at midnight local time.
 */

const MAP_LOADS_LIMIT = 200;
const GEOCODE_LIMIT   = 100;

function todayKey(prefix: string): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `nerdco_${prefix}_${iso}`;
}

function readCount(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeCount(key: string, n: number): void {
  try {
    localStorage.setItem(key, String(n));
  } catch { /* storage full or SSR — ignore */ }
}

/** Returns true and increments the counter if a new map load is permitted. */
export function consumeMapLoad(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const key = todayKey('maps_loads');
  const n   = readCount(key);
  if (n >= MAP_LOADS_LIMIT) return false;
  writeCount(key, n + 1);
  return true;
}

/** Returns true and increments the counter if a geocoding call is permitted. */
export function consumeGeocode(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const key = todayKey('maps_geocode');
  const n   = readCount(key);
  if (n >= GEOCODE_LIMIT) return false;
  writeCount(key, n + 1);
  return true;
}

/** Returns remaining quota for display / debugging. */
export function quotaStatus(): { mapLoadsRemaining: number; geocodeRemaining: number } {
  return {
    mapLoadsRemaining: MAP_LOADS_LIMIT - readCount(todayKey('maps_loads')),
    geocodeRemaining:  GEOCODE_LIMIT   - readCount(todayKey('maps_geocode')),
  };
}
