// Single responsibility: allow only internal service callers to reach /auth/verify
// Callers must include X-Service-Secret header matching SERVICE_INTERNAL_SECRET env var.
// If SERVICE_INTERNAL_SECRET is not set (local dev), the check is skipped.

module.exports = function requireServiceSecret(req, res, next) {
  const secret = process.env.SERVICE_INTERNAL_SECRET;
  if (!secret) return next(); // not configured — pass through (dev/test mode)
  if (req.headers['x-service-secret'] !== secret) {
    return res.status(403).json({ error: 'forbidden', message: 'Internal endpoint' });
  }
  next();
};
