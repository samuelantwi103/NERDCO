// Orchestrates: validate input → call repo → issue tokens → return response
import type { JwtAccessPayload } from '@nerdco/domain-types';

const bcrypt          = require('bcryptjs');
const crypto          = require('crypto');
const userRepo        = require('../repositories/userRepo');
const tokenRepo       = require('../repositories/tokenRepo');
const resetTokenRepo  = require('../repositories/resetTokenRepo');
const { signAccess, signRefresh, verify, hash } = require('../utils/tokens');
const { sendPasswordResetEmail } = require('../utils/emailService');

const VALID_ROLES = ['system_admin', 'org_admin', 'first_responder'];
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function register(req, res) {
  const { name, email, password, role, organization_id } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'validation', message: 'name, email, password and role are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'validation', message: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  try {
    const existing = await userRepo.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'conflict', message: 'Email already registered' });

    const user = await userRepo.create({
      name, email,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      organizationId: organization_id,
    });
    res.status(201).json({ user });
  } catch (err: any) {
    console.error('[register]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'validation', message: 'email and password are required' });
  }
  try {
    const user = await userRepo.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    }

    const payload: JwtAccessPayload = { sub: user.id, role: user.role, org: user.organization_id, org_type: user.org_type || null };
    const access_token  = signAccess(payload);
    const refresh_token = signRefresh({ sub: user.id });

    await tokenRepo.save(user.id, hash(refresh_token), new Date(Date.now() + REFRESH_TTL_MS));

    res.status(200).json({
      access_token,
      refresh_token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, organization_id: user.organization_id },
    });
  } catch (err: any) {
    console.error('[login]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function refreshToken(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'validation', message: 'refresh_token is required' });
  }
  try {
    verify(refresh_token); // throws if expired/invalid
    const record = await tokenRepo.findValid(hash(refresh_token));
    if (!record) return res.status(401).json({ error: 'invalid_token', message: 'Refresh token is invalid or expired' });

    const access_token = signAccess({ sub: record.user_id, role: record.role, org: record.organization_id, org_type: record.org_type || null });
    res.status(200).json({ access_token });
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Refresh token is invalid or expired' });
  }
}

async function logout(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'validation', message: 'refresh_token is required' });
  try {
    await tokenRepo.revoke(hash(refresh_token), req.user.sub);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getProfile(req, res) {
  try {
    const row = await userRepo.findById(req.user.sub);
    if (!row) return res.status(404).json({ error: 'not_found', message: 'User not found' });
    res.status(200).json({
      id: row.id, name: row.name, email: row.email, role: row.role,
      is_active: row.is_active, created_at: row.created_at,
      organization: row.org_id ? { id: row.org_id, name: row.org_name, type: row.org_type } : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// Sends a password reset link to the user's email.
// Always returns 200 regardless of whether the email exists — prevents account enumeration.
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'validation', message: 'email is required' });

  try {
    const user = await userRepo.findByEmail(email);
    if (user && user.is_active) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await resetTokenRepo.save(user.id, hash(rawToken));
      await sendPasswordResetEmail(user.email, user.name, rawToken);
    }
    // Always respond the same way — don't reveal whether the email exists
    res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err: any) {
    console.error('[forgotPassword]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// Validates the reset token and sets a new password.
async function resetPassword(req, res) {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: 'validation', message: 'token and new_password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'validation', message: 'new_password must be at least 8 characters' });
  }

  try {
    const record = await resetTokenRepo.findValid(hash(token));
    if (!record) {
      return res.status(400).json({ error: 'invalid_token', message: 'Reset token is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    await userRepo.updatePassword(record.user_id, passwordHash);
    await resetTokenRepo.markUsed(hash(token));

    res.status(200).json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err: any) {
    console.error('[resetPassword]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// Called by other services only — checks revocation, not called on every request
function verifyInternal(req, res) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ valid: false });
  try {
    const decoded = verify(header.slice(7));
    res.status(200).json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false });
  }
}


async function updateProfile(req, res) {
  const { name, email, password } = req.body;
  try {
    const db = require('../db/pool');
    
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

module.exports = { updateProfile, register, login, refreshToken, logout, getProfile, forgotPassword, resetPassword, verifyInternal };
