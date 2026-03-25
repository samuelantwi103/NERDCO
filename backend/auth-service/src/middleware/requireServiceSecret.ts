// Single responsibility: allow only internal service callers to reach /auth/verify
// Callers must include X-Service-Secret header matching SERVICE_INTERNAL_SECRET env var.
// In test environments the check is skipped; all other environments require the secret.

const isTest = process.env.NODE_ENV === 'test';

if (!process.env.SERVICE_INTERNAL_SECRET && !isTest) {
  throw new Error(
    'SERVICE_INTERNAL_SECRET must be set. ' +
    'Internal endpoints are not accessible without it.'
  );
}

module.exports = function requireServiceSecret(req, res, next) {
  const secret = process.env.SERVICE_INTERNAL_SECRET;
  if (!secret) return next(); // test mode — no secret configured
  if (req.headers['x-service-secret'] !== secret) {
    return res.status(403).json({ error: 'forbidden', message: 'Internal endpoint' });
  }
  next();
};
