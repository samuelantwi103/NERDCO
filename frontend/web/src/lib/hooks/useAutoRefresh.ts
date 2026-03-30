import { useEffect, useRef, useState } from 'react';

/** Calls `fn` immediately, then every `intervalMs` milliseconds. */
export function useAutoRefresh(fn: () => Promise<void> | void, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setRefreshing(true);
      setError(null);
      try {
        await fnRef.current();
        if (!cancelled) setLastUpdated(new Date());
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to refresh data');
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    run();
    const id = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { lastUpdated, refreshing, error };
}
