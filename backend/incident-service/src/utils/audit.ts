// Single responsibility: format actor context string for incident_status_log notes
// Appends [audit: role=X, org=Y, ip=Z] prefix so every status change is traceable
// without requiring a schema migration — the existing `notes` TEXT column carries it.

export function auditContext(req: any): string {
  const role = req.user?.role  ?? 'unknown';
  const org  = req.user?.org   ?? 'none';
  const ip   = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
             ?? req.socket?.remoteAddress
             ?? 'unknown';
  return `[audit: role=${role}, org=${org}, ip=${ip}]`;
}

export function withAudit(req: any, notes?: string | null): string {
  const prefix = auditContext(req);
  return notes ? `${prefix} ${notes}` : prefix;
}
