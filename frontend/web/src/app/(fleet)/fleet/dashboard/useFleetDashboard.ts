import { useState } from 'react';
import { listVehicles } from '@/lib/api/tracking';
import { listOpenIncidents, reassignIncident } from '@/lib/api/incidents';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { POLLING } from '@/lib/config/polling';

export function useFleetDashboard(token: string) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncId, setSelectedIncId] = useState<string | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [loading, setLoading] = useState(true);

  useAutoRefresh(async () => {
    if (!token) return;
    try {
      const [v, i] = await Promise.all([listVehicles(token), listOpenIncidents(token)]);
      setVehicles(v);
      setIncidents(i);
    } catch (e) {
      // Intentionally swallow errors (like 401s which are handled globally)
    } finally {
      setLoading(false);
    }
  }, POLLING.FLEET);

  const overrideIncident = async (incidentId: string, vehicleId: string) => {
    setOverriding(true);
    try {
      await reassignIncident(token, incidentId, vehicleId);
      const [v, i] = await Promise.all([listVehicles(token), listOpenIncidents(token)]);
      setVehicles(v); 
      setIncidents(i); 
      setSelectedIncId(null);
    } catch (e) {
      console.error('Override failed', e);
      // fallback: refresh state anyway in case incident was modified
      try {
        const [v, i] = await Promise.all([listVehicles(token), listOpenIncidents(token)]);
        setVehicles(v);
        setIncidents(i);
      } catch (err) {}
    } finally {
      setOverriding(false);
    }
  };

  return {
    state: { vehicles, incidents, selectedIncId, overriding, loading },
    actions: { setSelectedIncId, overrideIncident }
  };
}