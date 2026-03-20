const router               = require('express').Router();
const verifyJwt            = require('../middleware/verifyJwt');
const verifyJwtOrSecret    = require('../middleware/verifyJwtOrSecret');
const requireRole          = require('../middleware/requireRole');
const ctrl                 = require('../controllers/orgController');

router.get('/',                        verifyJwt, ctrl.list);
router.post('/',                       verifyJwt, requireRole('system_admin'), ctrl.create);
// Internal or hospital-admin: get hospitals that currently have beds available
router.get('/hospitals/available',     verifyJwtOrSecret, ctrl.listHospitalsWithCapacity);
// Hospital admin sets capacity; incident-service adjusts by delta via service secret
router.patch('/:id/capacity',          verifyJwtOrSecret, ctrl.updateCapacity);

module.exports = router;
