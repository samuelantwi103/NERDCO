const vehicleRepo = require('../repositories/vehicleRepo');
const { publish } = require('../utils/publisher');
const { broadcast } = require('../websocket/wsServer');

export interface SimulationState {
  vehicleId: string;
  incidentId: string;
  isMedical: boolean;
  destinationName: string;
  waypoints: { lat: number, lng: number }[];
  splitIdx: number;
  currentStep: number;
  intervalMs: number;
  phase: 'to_incident' | 'to_hospital' | 'to_base';
  timer?: NodeJS.Timeout;
}

const activeSimulations = new Map<string, SimulationState>();

async function startSimulation(req: any, res: any) {
  if (req.user.role !== 'system_admin') return res.status(403).json({ error: 'forbidden' });
  const { id: vehicleId } = req.params;
  const { incidentId, isMedical, destinationName, path, splitIdx, speedMs = 1000 } = req.body;

  if (!incidentId || !path || !path.length || splitIdx == null) {
    return res.status(400).json({ error: 'validation', message: 'Missing simulation parameters' });
  }

  if (activeSimulations.has(vehicleId)) {
    clearInterval(activeSimulations.get(vehicleId)!.timer);
    activeSimulations.delete(vehicleId);
  }

  const existingVehicle = await vehicleRepo.findById(vehicleId);
  if (!existingVehicle) return res.status(404).json({ error: 'not_found', message: 'Vehicle not found' });

  const state: SimulationState = {
    vehicleId,
    incidentId,
    isMedical,
    destinationName,
    waypoints: path,
    splitIdx,
    currentStep: 0,
    intervalMs: speedMs,
    phase: 'to_incident'
  };

  state.timer = setInterval(async () => {
    state.currentStep++;
    
    if (state.currentStep >= state.waypoints.length) {
      clearInterval(state.timer);
      activeSimulations.delete(vehicleId);
      return;
    }

    const wpt = state.waypoints[state.currentStep];

    try {
      const vehicle = await vehicleRepo.updateLocation({ id: vehicleId, latitude: wpt.lat, longitude: wpt.lng });
      if (vehicle) {
        const recorded_at = new Date().toISOString();
        await vehicleRepo.saveLocationHistory({ vehicleId, latitude: wpt.lat, longitude: wpt.lng, recordedAt: recorded_at });
        const payload = { vehicle_id: vehicle.id, vehicle_type: vehicle.vehicle_type, status: vehicle.status, latitude: wpt.lat, longitude: wpt.lng, recorded_at };
        publish('vehicle.location.updated', payload);
        broadcast({ type: 'vehicle.location.updated', payload });
      }
    } catch {
      // non-fatal
    }

    if (state.currentStep >= state.splitIdx && state.phase === 'to_incident') {
      state.phase = state.isMedical ? 'to_hospital' : 'to_base';
    }

  }, speedMs);

  activeSimulations.set(vehicleId, state);

  res.status(200).json({ message: 'Simulation started', vehicleId });
}

async function stopSimulation(req: any, res: any) {
  if (req.user.role !== 'system_admin') return res.status(403).json({ error: 'forbidden' });
  const { id: vehicleId } = req.params;
  
  if (activeSimulations.has(vehicleId)) {
    clearInterval(activeSimulations.get(vehicleId)!.timer);
    activeSimulations.delete(vehicleId);
  }
  
  res.status(200).json({ message: 'Simulation stopped' });
}

async function listActive(req: any, res: any) {
  if (req.user.role !== 'system_admin') return res.status(403).json({ error: 'forbidden' });
  
  const payload = Array.from(activeSimulations.values()).map(s => ({
    vehicleId: s.vehicleId,
    incidentId: s.incidentId,
    isMedical: s.isMedical,
    destinationName: s.destinationName,
    splitIdx: s.splitIdx,
    currentStep: s.currentStep,
    totalSteps: s.waypoints.length,
    phase: s.phase
  }));
  
  res.status(200).json({ simulations: payload });
}

module.exports = { startSimulation, stopSimulation, listActive };
