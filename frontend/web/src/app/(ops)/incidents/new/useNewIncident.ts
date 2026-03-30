import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createIncident, reassignIncident } from '@/lib/api/incidents';
import { getVehicle } from '@/lib/api/tracking';
import type { PickedLocation } from '@/components/LocationPicker';

export function useNewIncident(token: string) {
  const router = useRouter();
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [type, setType] = useState('medical');
  const [caller, setCaller] = useState('');
  const [notes, setNotes] = useState('');
  const [multipleCasualties, setMultipleCasualties] = useState(false);
  const [mciUnits, setMciUnits] = useState<Record<string, number>>({ ambulance: 2, fire_truck: 0, police_car: 0 });
  const [requiredCapability, setRequiredCapability] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [clockDeltaMs, setClockDeltaMs] = useState(0);
  const [assignedVehicle, setAssignedVehicle] = useState<any | null>(null);
  const [conflict, setConflict] = useState<any | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [error, setError] = useState('');
  // Ref guard prevents double-submit when operator clicks Dispatch twice quickly
  const submittingRef = useRef(false);

  const submitIncident = async () => {
    if (!location) {
      setError('Drop a pin on the map first.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);
    setConflict(null);
    try {
      const data = await createIncident(token, {
        incident_type: type,
        latitude: location.lat,
        longitude: location.lng,
        location_name: location.name || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
        citizen_name: caller || 'Unknown',
        notes: notes || undefined,
        mci_units: multipleCasualties ? mciUnits : undefined,
        required_capability: requiredCapability || undefined,
      });
      setResult(data);
      if (data.incident?.created_at) {
        setClockDeltaMs(Date.parse(data.incident.created_at) - Date.now());
      }
      if (data.incident?.assigned_unit_id) {
        getVehicle(token, data.incident.assigned_unit_id)
          .then(setAssignedVehicle)
          .catch(() => {});
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const body   = err?.response?.data;
      if (status === 409 && body?.existing_incident?.id) {
        // Duplicate detected — show conflict modal
        setConflict(body.existing_incident);
        return;
      }
      setError(body?.message ?? 'Failed to create incident');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const overrideAssignment = async (vehicleId: string) => {
    if (!result?.incident) return;
    setOverriding(true);
    try {
      const updated = await reassignIncident(token, result.incident.id, vehicleId);
      const newInc = updated.incident ?? updated;
      setResult({ ...result, incident: newInc, alternative_responders: [] });
      if (newInc.assigned_unit_id) {
        getVehicle(token, newInc.assigned_unit_id)
          .then(setAssignedVehicle)
          .catch(() => {});
      }
    } finally {
      setOverriding(false);
    }
  };

  const done = () => router.push('/dashboard');

  return {
    state: {
      location, type, caller, notes, loading, result, assignedVehicle, overriding, error, clockDeltaMs,
      multipleCasualties, mciUnits, conflict, requiredCapability,
    },
    actions: {
      setLocation, setType, setCaller, setNotes, submitIncident, overrideAssignment, done,
      setMultipleCasualties, setConflict, setRequiredCapability,
      setMciUnit: (type: string, count: number) => setMciUnits(prev => ({ ...prev, [type]: count })),
    }
  };
}