const fs = require('fs');
const rtPath = 'backend/auth-service/src/routes/organizations.ts';
let rt = fs.readFileSync(rtPath, 'utf8');
rt = rt.replace('module.exports = router;', 'router.put(\'/:id\', verifyJwt, requireRole(\'system_admin\'), ctrl.update);\nrouter.delete(\'/:id\', verifyJwt, requireRole(\'system_admin\'), ctrl.remove);\n\nmodule.exports = router;');
fs.writeFileSync(rtPath, rt);
