// Single responsibility: allow either a valid JWT (org_admin/system_admin)
// or the X-Service-Secret header (internal service calls) to proceed.
// If a JWT is present it is verified and attached to req.user.
// If only the service secret is present, req.user is left undefined.
import type { JwtAccessPayload } from '@nerdco/domain-types';

const jwt = require('jsonwebtoken');

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error('JWT_PUBLIC_KEY is required');
  return key.replace(/\\n/g, '\n');
}

module.exports = function verifyJwtOrSecret(req, res, next) {
  const serviceSecret = process.env.SERVICE_INTERNAL_SECRET;
  const sentSecret    = req.headers['x-service-secret'];

  // Service-to-service path (no JWT required)
  if (serviceSecret && sentSecret === serviceSecret) {
    return next();
  }

  // JWT path
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_credentials', message: 'Authorization header or service secret required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), getPublicKey(), { algorithms: ['RS256'] }) as JwtAccessPayload;
    // Only org_admin and system_admin may update capacity via JWT
    if (!['org_admin', 'system_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient role to update hospital capacity' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Token is invalid or expired' });
  }
};
