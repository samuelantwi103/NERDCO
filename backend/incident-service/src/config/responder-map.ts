// Maps incident type → vehicle type for nearest-responder selection
const RESPONDER_MAP: Record<string, string> = {
  medical: 'ambulance',
  fire:    'fire_truck',
  robbery: 'police_car',
  crime:   'police_car',
};

// Maps org type → incident types that org is responsible for
// Used to scope what org_admin users can see
// ambulance_service (e.g. NAS) and hospital both handle medical incidents:
//   - ambulance_service dispatches vehicles
//   - hospital receives patients and can also create inter-facility transfer incidents
const ORG_TYPE_INCIDENT_MAP: Record<string, string[]> = {
  ambulance_service: ['medical'],
  hospital:          ['medical'],
  police_station:    ['robbery', 'crime'],
  fire_station:      ['fire'],
};

module.exports = { RESPONDER_MAP, ORG_TYPE_INCIDENT_MAP };
