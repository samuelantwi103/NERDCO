const router     = require('express').Router();
const verifyJwt  = require('../middleware/verifyJwt');
const ctrl       = require('../controllers/authController');

router.post('/register',      ctrl.register);
router.post('/login',         ctrl.login);
router.post('/refresh-token', ctrl.refreshToken);
router.post('/logout',        verifyJwt, ctrl.logout);
router.get('/profile',        verifyJwt, ctrl.getProfile);
router.get('/verify',         ctrl.verifyInternal);   // internal only

module.exports = router;
