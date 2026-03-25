// Orchestrates: validate → create user → send welcome email → return response
const bcrypt        = require('bcryptjs');
const crypto        = require('crypto');
const userRepo      = require('../repositories/userRepo');
const orgRepo       = require('../repositories/orgRepo');
const { sendWelcomeEmail } = require('../utils/emailService');

const VALID_ROLES = ['system_admin', 'org_admin', 'first_responder'];

// POST /auth/users — admin creates a staff account with a temp password
async function createUser(req, res) {
  const { name, email, role, organization_id } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ error: 'validation', message: 'name, email and role are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'validation', message: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  // org_admin can only create users in their own org, and cannot escalate to system_admin
  if (req.user.role === 'org_admin') {
    if (role === 'system_admin') {
      return res.status(403).json({ error: 'forbidden', message: 'org_admin cannot create system_admin accounts' });
    }
    if (organization_id && organization_id !== req.user.org) {
      return res.status(403).json({ error: 'forbidden', message: 'org_admin can only create users in their own organisation' });
    }
  }

  // Resolve the organisation_id: org_admin always uses their own org
  const resolvedOrgId = req.user.role === 'org_admin' ? req.user.org : (organization_id || null);

  try {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'conflict', message: 'Email already registered' });
    }

    // Generate a secure temporary password — sent via welcome email
    const tempPassword  = crypto.randomBytes(8).toString('hex'); // 16-char hex
    const passwordHash  = await bcrypt.hash(tempPassword, 12);

    const user = await userRepo.create({ name, email, passwordHash, role, organizationId: resolvedOrgId });

    // Look up org name for the welcome email (non-fatal if it fails)
    let orgName: string | undefined;
    if (resolvedOrgId) {
      const org = await orgRepo.findById(resolvedOrgId).catch(() => null);
      orgName = org?.name;
    }

    await sendWelcomeEmail(email, name, tempPassword);

    res.status(201).json({
      user: {
        id:              user.id,
        name:            user.name,
        email:           user.email,
        role:            user.role,
        organization_id: user.organization_id,
      },
      message: 'Account created. A welcome email with login credentials has been sent.',
    });
  } catch (err: any) {
    console.error('[createUser]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// GET /auth/users — list users (system_admin: all; org_admin: own org)
async function listUsers(req, res) {
  try {
    const includeDeleted = req.user.role === 'system_admin' && req.query.include_deleted === 'true';
    const users = req.user.role === 'system_admin'
      ? await userRepo.listAll({ includeDeleted })
      : await userRepo.listByOrg(req.user.org);

    res.status(200).json({ users });
  } catch (err: any) {
    console.error('[listUsers]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

// PUT /auth/users/:id — update user metadata (role, name, active status)
async function updateUser(req, res) {
  const { id } = req.params;
  const { name, role, is_active, organization_id } = req.body;

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'validation', message: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  try {
    const existing = await userRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'User not found' });
    }

    // Role-based access control for editing
    if (req.user.role === 'org_admin') {
      if (existing.org_id && existing.org_id !== req.user.org) {
        return res.status(403).json({ error: 'forbidden', message: 'Cannot edit users outside your organisation' });
      }
      if (role === 'system_admin') {
        return res.status(403).json({ error: 'forbidden', message: 'org_admin cannot grant system_admin role' });
      }
      if (organization_id && organization_id !== req.user.org) {
        return res.status(403).json({ error: 'forbidden', message: 'Cannot reassign user to another organisation' });
      }
    }

    const updates = {
      id,
      name: name !== undefined ? name : existing.name,
      role: role !== undefined ? role : existing.role,
      is_active: is_active !== undefined ? is_active : existing.is_active,
      organizationId: organization_id !== undefined ? organization_id : existing.org_id
    };

    const updatedUser = await userRepo.update(updates);
    res.status(200).json({ user: updatedUser, message: 'User updated successfully' });
  } catch (err: any) {
    console.error('[updateUser]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function deleteUser(req: any, res: any) {
  try {
    const { id } = req.params;
    const existing = await userRepo.findById(id);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'User not found' });
    
    // Authorization check
    if (req.user.role !== 'system_admin') {
      if (req.user.org !== existing.org_id) {
        return res.status(403).json({ error: 'forbidden', message: 'Cannot delete users outside your organisation' });
      }
    }

    await userRepo.remove(id);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('[deleteUser]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function restoreUser(req: any, res: any) {
  try {
    const { id } = req.params;
    await userRepo.restore(id);
    res.status(200).json({ message: 'User restored successfully' });
  } catch (err: any) {
    console.error('[restoreUser]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

async function hardDeleteUser(req: any, res: any) {
  try {
    const { id } = req.params;
    await userRepo.hardDelete(id);
    res.status(200).json({ message: 'User permanently deleted' });
  } catch (err: any) {
    console.error('[hardDeleteUser]', err?.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
}

module.exports = { createUser, listUsers, updateUser, deleteUser, restoreUser, hardDeleteUser };
