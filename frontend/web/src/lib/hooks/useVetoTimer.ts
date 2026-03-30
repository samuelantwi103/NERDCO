import { useState, useEffect } from 'react';

/**
 * Counts down from `windowSecs` seconds, starting from `dispatchedAt`.
 * `clockDeltaMs` corrects for server/client clock skew:
 *   clockDeltaMs = Date.parse(incident.created_at) - Date.now() at creation time.
 * Returns { remaining, expired }.
 */
export function useVetoTimer(dispatchedAt: string | null, windowSecs = 30, clockDeltaMs = 0) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!dispatchedAt) return;
    const dispatched = new Date(dispatchedAt).getTime();

    function update() {
      const elapsed = (Date.now() + clockDeltaMs - dispatched) / 1000;
      const left    = Math.max(0, windowSecs - elapsed);
      setRemaining(Math.round(left));
    }

    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [dispatchedAt, windowSecs, clockDeltaMs]);

  return { remaining, expired: remaining === 0 };
}
