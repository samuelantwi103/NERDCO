const router      = require('express').Router();
const verifyJwt   = require('../middleware/verifyJwt');
const requireRole = require('../middleware/requireRole');
const ctrl        = require('../controllers/orgController');

router.get('/',  verifyJwt, ctrl.list);
router.post('/', verifyJwt, requireRole('system_admin'), ctrl.create);

module.exports = router;
