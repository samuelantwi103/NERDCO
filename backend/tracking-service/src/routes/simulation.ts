const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/simulationController');
const verifyJwt = require('../middleware/verifyJwt');

router.use(verifyJwt);

router.post('/:id/start', ctrl.startSimulation);
router.post('/:id/stop', ctrl.stopSimulation);
router.get('/active', ctrl.listActive);

module.exports = router;
