import { useState, useCallback, useEffect } from 'react';
import { listOpenIncidents, getIncident, reassignIncident, updateIncidentStatus } from '@/lib/api/incidents';
import { listVehicles } from '@/lib/api/tracking';
import { listOrganizations } from '@/lib/api/auth';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { POLLING } from '@/lib/config/polling';

export function useDashboardState(token: string, notify?: { success: (title: string, msg: string) => void }) {
  const [incidents,     setIncidents]     = useState<any[]>([]);
  const [vehicles,      setVehicles]      = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [detail,        setDetail]        = useState<any | null>(null);
  const [statusBusy,    setStatusBusy]    = useState(false);
  const [overriding,    setOverriding]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Fetch organizations once on mount (used for facility markers + hospital routing)
  useEffect(() => {
    if (!token) return;
    listOrganizations(token).then(setOrganizations).catch(() => {});
  }, [token]);

  // Poll open incidents
  useAutoRefresh(async () => {
    if (!token) return;
    try {
      setIncidents(await listOpenIncidents(token));
      setError(null);
    } catch {
      setError('Failed to load incidents');
    }
  }, POLLING.DASHBOARD);

  // Poll vehicles
  useAutoRefresh(async () => {
    if (!token) return;
    try {
      setVehicles(await listVehicles(token));
    } catch { /* swallow */ }
  }, POLLING.DASHBOARD);

  const selectIncident = useCallback(async (id: string) => {
    setSelectedId(id);
    if (token) {
      const data = await getIncident(token, id);
      if (data.status === 'resolved' || data.status === 'cancelled') {
        setDetail({ ...data, _closed: true });
      } else {
        setDetail(data);
      }
    }
  }, [token]);

  const handleStatusUpdate = useCallback(async (status: string) => {
    if (!detail || !token) return;
    setStatusBusy(true);
    try {
      await updateIncidentStatus(token, detail.id, status);
      const label = status === 'in_progress' ? 'In Progress' : status[0].toUpperCase() + status.slice(1);
      notify?.success('Incident updated', `Marked ${label}`);
      const [updated, fresh] = await Promise.all([getIncident(token, detail.id), listOpenIncidents(token)]);
      setDetail(updated);
      setIncidents(fresh);
    } finally { setStatusBusy(false); }
  }, [detail, token]);

  const handleOverride = useCallback(async (vehicleId: string) => {
    if (!detail || !token) return;
    setOverriding(true);
    try {
      const updated = await reassignIncident(token, detail.id, vehicleId);
      setDetail(updated.incident ?? updated);
    } finally { setOverriding(false); }
  }, [detail, token]);

  return {
    incidents, vehicles, organizations, selectedId, detail,
    statusBusy, overriding, error,
    selectIncident, handleStatusUpdate, handleOverride,
  };
}
