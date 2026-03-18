const orgRepo = require('../repositories/orgRepo');

const VALID_TYPES = ['hospital', 'police_station', 'fire_station'];

async function list(req, res) {
  try {
    res.json({ organizations: await orgRepo.findAll() });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function create(req, res) {
  const { name, type, latitude, longitude, address, phone } = req.body;
  if (!name || !type || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'validation', message: 'name, type, latitude and longitude are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'validation', message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  try {
    res.status(201).json({ organization: await orgRepo.create({ name, type, latitude, longitude, address, phone }) });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { list, create };
