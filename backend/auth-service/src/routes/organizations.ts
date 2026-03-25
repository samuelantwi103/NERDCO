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

router.get('/:id',    verifyJwt, ctrl.getById);
router.put('/:id',    verifyJwt, requireRole('system_admin'), ctrl.update);
router.delete('/:id', verifyJwt, requireRole('system_admin'), ctrl.remove);

module.exports = router;
