const router      = require('express').Router();
const verifyJwt   = require('../middleware/verifyJwt');
const requireRole = require('../middleware/requireRole');
const ctrl        = require('../controllers/userController');

// system_admin can manage all users; org_admin can create + list users in their own org
router.get('/',  verifyJwt, requireRole('system_admin', 'org_admin'), ctrl.listUsers);
router.post('/', verifyJwt, requireRole('system_admin', 'org_admin'), ctrl.createUser);
router.put('/:id', verifyJwt, requireRole('system_admin', 'org_admin'), ctrl.updateUser);
router.delete('/:id', verifyJwt, requireRole('system_admin', 'org_admin'), ctrl.deleteUser);
router.post('/:id/restore', verifyJwt, requireRole('system_admin'), ctrl.restoreUser);
router.delete('/:id/permanent', verifyJwt, requireRole('system_admin'), ctrl.hardDeleteUser);

module.exports = router;
