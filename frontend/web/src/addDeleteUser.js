const fs = require('fs');
const ctrPath = 'backend/auth-service/src/controllers/userController.ts';
let ctr = fs.readFileSync(ctrPath, 'utf8');
if (!ctr.includes('deleteUser')) {
  ctr = ctr.replace('module.exports = { createUser, listUsers, updateUser };',
  sync function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const existing = await require('../repositories/userRepo').findById(id);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'User not found' });
    if (req.user.role !== 'system_admin') {
      if (req.user.organizationId !== existing.org_id) {
        return res.status(403).json({ error: 'forbidden', message: 'Cannot delete users outside your organisation' });
      }
      if (existing.role === 'system_admin') {
         return res.status(403).json({ error: 'forbidden', message: 'Cannot delete system admins' });
      }
    }
    await require('../db').query('DELETE FROM users WHERE id = \\', [id]);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}
module.exports = { createUser, listUsers, updateUser, deleteUser };);
  fs.writeFileSync(ctrPath, ctr);
}
const rtPath = 'backend/auth-service/src/routes/users.ts';
let rt = fs.readFileSync(rtPath, 'utf8');
if (!rt.includes('deleteUser')) {
  rt = rt.replace('module.exports = router;', 'router.delete(\'/:id\', verifyJwt, requireRole(\'system_admin\', \'org_admin\'), ctrl.deleteUser);\nmodule.exports = router;');
  fs.writeFileSync(rtPath, rt);
}
console.log('Added delete user');
