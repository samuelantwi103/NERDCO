// Single responsibility: send transactional emails via Brevo HTTP API.
// Brevo free tier: 300 emails/day, no domain verification required (single sender only).
// Using HTTP API instead of SMTP — works on Render free tier which blocks outbound SMTP.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function getConfig() {
  return {
    apiKey:   process.env.BREVO_API_KEY || '',
    from:     process.env.EMAIL_FROM      || 'noreply@nerdco.gov.gh',
    fromName: process.env.EMAIL_FROM_NAME || 'NERDCO Emergency Platform',
  };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const { apiKey, from, fromName } = getConfig();

  if (!apiKey) {
    console.warn('[email] BREVO_API_KEY not set — skipping email send');
    return false;
  }

  const payload = {
    sender:      { name: fromName, email: from },
    to:          [{ email: to }],
    subject,
    htmlContent: html,
    textContent: html.replace(/<[^>]*>/g, ''),
  };

  try {
    const res = await fetch(BREVO_API_URL, {
      method:  'POST',
      headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      console.error('[email] Send failed:', err?.message || res.status);
      return false;
    }

    console.log(`[email] Sent to ${to}: ${subject}`);
    return true;
  } catch (err: any) {
    console.error('[email] Network error:', err?.message);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<boolean> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl    = `${frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#cc0000;">NERDCO — Password Reset</h2>
      <p>Hi ${name},</p>
      <p>A password reset was requested for your NERDCO account.</p>
      <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}"
           style="background:#cc0000;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;">
          Reset My Password
        </a>
      </p>
      <p>Or copy this link into your browser:<br>
         <small style="color:#555;">${resetUrl}</small>
      </p>
      <p style="color:#888;font-size:12px;margin-top:32px;">
        If you did not request a password reset, ignore this email — your account is safe.
        This link will expire automatically.
      </p>
    </div>
  `;

  return sendEmail(to, 'NERDCO — Password Reset Request', html);
}

export async function sendWelcomeEmail(to: string, name: string, tempPassword?: string): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#cc0000;">Welcome to NERDCO</h2>
      <p>Hi ${name},</p>
      <p>Your account on the NERDCO National Emergency Response Platform has been created.</p>
      ${tempPassword ? `<p>Your temporary password is: <strong style="font-size:18px;">${tempPassword}</strong></p>
      <p>Please log in and change your password immediately.</p>` : ''}
      <p style="color:#888;font-size:12px;margin-top:32px;">
        NERDCO — Coordinating Ghana's emergency response services.
      </p>
    </div>
  `;

  return sendEmail(to, 'Welcome to NERDCO', html);
}
