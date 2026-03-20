const router    = require('express').Router();
const verifyJwt = require('../middleware/verifyJwt');
const ctrl      = require('../controllers/analyticsController');

router.get('/summary',              verifyJwt, ctrl.getSummary);
router.get('/response-times',       verifyJwt, ctrl.getResponseTimes);
router.get('/incidents-by-region',  verifyJwt, ctrl.getIncidentsByRegion);
router.get('/resource-utilization', verifyJwt, ctrl.getResourceUtilization);
router.get('/bed-utilization',      verifyJwt, ctrl.getBedUtilization);
router.get('/most-deployed',        verifyJwt, ctrl.getMostDeployed);

module.exports = router;
