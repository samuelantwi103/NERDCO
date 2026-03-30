import { useState, useEffect, useCallback } from 'react';
import { listVehicles } from '@/lib/api/tracking';
import { useWebSocket } from '@/lib/hooks/useWebSocket';

export function useVehicleMap(token: string) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchVehicles = useCallback(() => {
    if (!token) return;
    listVehicles(token)
      .then(v => { setVehicles(v); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const wsStatus = useWebSocket(token, (msg: any) => {
    if (msg.type === 'vehicle.location.updated') {
      setVehicles(prev => prev.map(v =>
        v.id === msg.payload?.vehicle_id
          ? { ...v, latitude: msg.payload.latitude, longitude: msg.payload.longitude }
          : v
      ));
    }
    if (msg.type === 'vehicle.status.changed') {
      setVehicles(prev => prev.map(v =>
        v.id === msg.payload?.vehicle_id ? { ...v, status: msg.payload.new_status } : v
      ));
    }
  });

  return {
    state: { vehicles, loading, selected, wsStatus },
    actions: { setSelected, fetchVehicles }
  };
}