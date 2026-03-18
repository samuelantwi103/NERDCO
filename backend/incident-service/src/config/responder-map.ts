// Maps incident type → vehicle type for nearest-responder selection
const RESPONDER_MAP = {
  medical: 'ambulance',
  fire:    'fire_truck',
  robbery: 'police_car',
  crime:   'police_car',
};

module.exports = { RESPONDER_MAP };
