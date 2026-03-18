// Orchestrates: validate input → call repo → issue tokens → return response
import type { JwtAccessPayload } from '@nerdco/domain-types';

const bcrypt = require('bcryptjs');
const userRepo  = require('../repositories/userRepo');
const tokenRepo = require('../repositories/tokenRepo');
const { signAccess, signRefresh, verify, hash } = require('../utils/tokens');

const VALID_ROLES = ['system_admin', 'hospital_admin', 'police_admin', 'fire_admin', 'ambulance_driver'];
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

    const payload: JwtAccessPayload = { sub: user.id, role: user.role, org: user.organization_id };
    const access_token  = signAccess(payload);
    const refresh_token = signRefresh({ sub: user.id });

    await tokenRepo.save(user.id, hash(refresh_token), new Date(Date.now() + REFRESH_TTL_MS));

    res.json({
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

    const access_token = signAccess({ sub: record.user_id, role: record.role, org: record.organization_id });
    res.json({ access_token });
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Refresh token is invalid or expired' });
  }
}

async function logout(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'validation', message: 'refresh_token is required' });
  try {
    await tokenRepo.revoke(hash(refresh_token), req.user.sub);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function getProfile(req, res) {
  try {
    const row = await userRepo.findById(req.user.sub);
    if (!row) return res.status(404).json({ error: 'not_found', message: 'User not found' });
    res.json({
      id: row.id, name: row.name, email: row.email, role: row.role,
      is_active: row.is_active, created_at: row.created_at,
      organization: row.org_id ? { id: row.org_id, name: row.org_name, type: row.org_type } : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// Called by other services only — checks revocation, not called on every request
function verifyInternal(req, res) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ valid: false });
  try {
    const decoded = verify(header.slice(7));
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false });
  }
}

module.exports = { register, login, refreshToken, logout, getProfile, verifyInternal };
