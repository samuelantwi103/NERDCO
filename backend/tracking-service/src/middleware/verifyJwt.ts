import type { JwtAccessPayload } from '@nerdco/domain-types';

const jwt = require('jsonwebtoken');

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error('JWT_PUBLIC_KEY is required');
  return key.replace(/\\n/g, '\n');
}

module.exports = function verifyJwt(req, res, next) {
  const serviceSecret = req.headers['x-service-secret'];
  if (serviceSecret && process.env.SERVICE_INTERNAL_SECRET && serviceSecret === process.env.SERVICE_INTERNAL_SECRET) {
    req.user = { sub: 'internal-service', role: 'system_admin' };
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token', message: 'Authorization header required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), getPublicKey(), { algorithms: ['RS256'] }) as JwtAccessPayload;
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Token is invalid or expired' });
  }
};
