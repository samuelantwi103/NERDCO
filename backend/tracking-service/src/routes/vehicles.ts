const router      = require('express').Router();
const verifyJwt   = require('../middleware/verifyJwt');
const requireRole = require('../middleware/requireRole');
const ctrl        = require('../controllers/vehicleController');

router.post('/register',     verifyJwt, requireRole('system_admin', 'org_admin'), ctrl.register);
router.get('/',              verifyJwt, ctrl.list);
router.get('/:id',           verifyJwt, ctrl.getOne);
router.get('/:id/location',  verifyJwt, ctrl.getLocation);
router.put('/:id/location',  verifyJwt, requireRole('first_responder', 'system_admin', 'org_admin'), ctrl.updateLocation);
router.put('/:id/status',    verifyJwt, requireRole('first_responder', 'system_admin', 'org_admin'), ctrl.updateStatus);

module.exports = router;
