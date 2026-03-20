const router               = require('express').Router();
const verifyJwt            = require('../middleware/verifyJwt');
const requireServiceSecret = require('../middleware/requireServiceSecret');
const ctrl                 = require('../controllers/authController');

router.post('/register',        ctrl.register);
router.post('/login',           ctrl.login);
router.post('/refresh-token',   ctrl.refreshToken);
router.post('/logout',          verifyJwt, ctrl.logout);
router.get('/profile',          verifyJwt, ctrl.getProfile);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password',  ctrl.resetPassword);
router.get('/verify',           requireServiceSecret, ctrl.verifyInternal); // internal services only

module.exports = router;
