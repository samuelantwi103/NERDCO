const fs = require('fs');
const path = '../../backend/auth-service/src/controllers/authController.ts';
let code = fs.readFileSync(path, 'utf8');

const newCode = `
async function updateProfile(req, res) {
  const { name, email, password } = req.body;
  try {
    const db = require('../db/pool').default;
    
    // Check if email is already taken by someone else
    if (email) {
      const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.sub]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'conflict', message: 'Email already in use' });
      }
    }

    if (name || email) {
      const current = await db.query('SELECT name, email FROM users WHERE id = $1', [req.user.sub]);
      const newName = name || current.rows[0].name;
      const newEmail = email || current.rows[0].email;
      await db.query('UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3', [newName, newEmail, req.user.sub]);
    }
    
    if (password) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(password, 10);
      await require('../repositories/userRepo').updatePassword(req.user.sub, hash);
    }
    
    const user = await require('../repositories/userRepo').findById(req.user.sub);
    res.status(200).json({ user, message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}
`;

code = code.replace('module.exports = { register,', newCode + '\nmodule.exports = { updateProfile, register,');
fs.writeFileSync(path, code);
console.log('updated');
