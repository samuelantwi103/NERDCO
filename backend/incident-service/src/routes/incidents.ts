const router      = require('express').Router();
const verifyJwt   = require('../middleware/verifyJwt');
const requireRole = require('../middleware/requireRole');
const ctrl        = require('../controllers/incidentController');

router.post('/',                      verifyJwt, requireRole('system_admin', 'org_admin'), ctrl.create);
router.get('/open',                   verifyJwt, ctrl.listOpen);
router.get('/:id',                    verifyJwt, ctrl.getOne);
router.put('/:id/status',             verifyJwt, requireRole('system_admin', 'org_admin', 'first_responder'), ctrl.updateStatus);
router.put('/:id/assign',             verifyJwt, requireRole('system_admin', 'org_admin'), ctrl.reassign);
router.post('/:id/request-support',   verifyJwt, ctrl.requestSupport);

module.exports = router;
