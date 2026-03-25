// Background job: retry auto-dispatch for incidents stuck in 'created' status.
// Runs every 30 seconds. Picks unassigned incidents and tries to claim the
// nearest available vehicle from the tracking service.
import { getAvailableVehicles, dispatchVehicle } from '../utils/trackingClient';
import { getHospitalsWithCapacity, adjustHospitalCapacity } from '../utils/authClient';
import type { VehicleModel } from '@nerdco/domain-types';

const incidentRepo = require('../repositories/incidentRepo');
const { RESPONDER_MAP } = require('../config/responder-map');
const { haversineKm }   = require('../utils/haversine');
const { publish }       = require('../utils/publisher');

const RETRY_INTERVAL_MS = 30_000;
const SERVICE_TOKEN     = process.env.SERVICE_INTERNAL_SECRET ?? '';

function serviceAuthHeader(): string {
  return `Bearer ${SERVICE_TOKEN}`;
}

async function retryUnassigned(): Promise<void> {
  let unassigned: any[];
  try {
    unassigned = await incidentRepo.findUnassigned(null);
  } catch {
    return; // DB not ready yet
  }

  for (const incident of unassigned) {
    const vehicleType = RESPONDER_MAP[incident.incident_type];
    if (!vehicleType) continue;

    let ranked: (VehicleModel & { distance_km: number })[];
    try {
      const vehicles = await getAvailableVehicles(vehicleType, serviceAuthHeader());
      ranked = vehicles
        .filter((v: VehicleModel) => v.latitude != null && v.longitude != null)
        .map((v: VehicleModel) => ({ ...v, distance_km: haversineKm(incident.latitude, incident.longitude, v.latitude, v.longitude) }))
        .sort((a: any, b: any) => a.distance_km - b.distance_km);
    } catch {
      continue;
    }

    if (!ranked.length) continue;

    let claimed: (VehicleModel & { distance_km: number }) | null = null;
    for (const v of ranked) {
      try {
        await dispatchVehicle(v.id, serviceAuthHeader(), incident.id);
        claimed = v;
        break;
      } catch (err: any) {
        if (err.response?.status === 409) continue;
        break;
      }
    }

    if (!claimed) continue;

    // For medical incidents, find nearest hospital with capacity
    let destHospital: any = null;
    if (incident.incident_type === 'medical') {
      try {
        const hospitals = await getHospitalsWithCapacity();
        if (hospitals.length) {
          destHospital = hospitals
            .map((h: any) => ({ ...h, distance_km: haversineKm(incident.latitude, incident.longitude, h.latitude, h.longitude) }))
            .sort((a: any, b: any) => a.distance_km - b.distance_km)[0];
        }
      } catch {}
    }

    await incidentRepo.assignUnit({
      id: incident.id,
      unitId: claimed.id,
      unitType: vehicleType,
      destinationHospitalId:   destHospital?.id   || null,
      destinationHospitalName: destHospital?.name || null,
    });
    await incidentRepo.logStatusChange({
      incidentId: incident.id,
      oldStatus: 'created',
      newStatus: 'dispatched',
      changedBy: 'system',
      notes: 'auto-retry dispatch',
    });

    if (destHospital) {
      adjustHospitalCapacity(destHospital.id, -1).catch(() => {});
    }

    publish('incident.dispatched', {
      incident_id:      incident.id,
      incident_type:    incident.incident_type,
      latitude:         incident.latitude,
      longitude:        incident.longitude,
      assigned_unit_id: claimed.id,
      assigned_unit_type: vehicleType,
      distance_km:      +claimed.distance_km.toFixed(2),
      dispatched_at:    new Date().toISOString(),
      retry:            true,
    });

    console.log(`[dispatchRetry] auto-dispatched incident ${incident.id} to vehicle ${claimed.id}`);
  }
}

export function startRetryJob(): void {
  setInterval(() => {
    retryUnassigned().catch(err =>
      console.error('[dispatchRetry] error:', err?.message)
    );
  }, RETRY_INTERVAL_MS);
  console.log('[incident-service] dispatch retry job started (interval: 30s)');
}
