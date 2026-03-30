'use client';
import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button, Field, Input, Text, Spinner,
  makeStyles,
} from '@fluentui/react-components';
import { resetPassword } from '@/lib/api/auth';

const useStyles = makeStyles({
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg)',
  },
  card: {
    width: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  },
  brandMark: {
    width: '32px', height: '32px',
    background: 'var(--gray-950)',
    borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', fontWeight: '800', color: '#FFF',
    letterSpacing: '-0.5px',
  },
  brandName: { fontWeight: '700', fontSize: '16px', letterSpacing: '-0.3px' },
  heading: { fontWeight: '700', fontSize: '24px', letterSpacing: '-0.5px', marginBottom: '2px' },
  subtitle: { color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '12px' },
  success: {
    padding: '10px 14px',
    background: 'var(--color-success-bg)',
    border: '1px solid var(--color-success-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    color: 'var(--color-success)',
  },
  error: {
    padding: '10px 14px',
    background: 'var(--color-fire-bg)',
    border: '1px solid var(--color-fire-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    color: 'var(--color-fire)',
  },
  hint: { color: 'var(--color-text-muted)', fontSize: '12px' },
  submitBtn: {
    marginTop: '4px',
    background: 'var(--gray-950)',
    border: 'none',
    height: '42px',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: 'var(--radius-md)',
  },
});

function ResetPasswordContent() {
  const styles = useStyles();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [status,    setStatus]    = useState<'idle' | 'loading' | 'done'>('idle');
  const [error,     setError]     = useState('');

  function passwordStrength(pw: string): { label: string; color: string; width: string } {
    if (pw.length === 0) return { label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: 'Weak',   color: '#D13438', width: '25%' };
    if (score <= 3) return { label: 'Fair',   color: '#F59E0B', width: '60%' };
    return              { label: 'Strong', color: '#16A34A', width: '100%' };
  }
  const strength = passwordStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setStatus('loading');
    try {
      await resetPassword(token, password);
      setStatus('done');
      setTimeout(() => router.replace('/login'), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Reset link may have expired. Request a new one.');
      setStatus('idle');
    }
  }

  const BrandHeader = () => (
    <div className={styles.brandRow}>
      <div className={styles.brandMark}>N</div>
      <span className={styles.brandName}>NERDCO</span>
    </div>
  );

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <BrandHeader />
          <Text className={styles.heading}>Invalid link</Text>
          <div className={styles.error}>This reset link is invalid or missing. Please request a new one.</div>
          <Button appearance="secondary" onClick={() => router.push('/forgot-password')}>
            Request reset link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <BrandHeader />
        <Text className={styles.heading}>Set new password</Text>
        <Text className={styles.subtitle}>Choose a strong password for your account.</Text>

        {status === 'done' ? (
          <div className={styles.success}>
            Password updated. Redirecting to sign in...
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="New password">
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
              />
            </Field>
            {password.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-4px' }}>
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: strength.width, background: strength.color, borderRadius: '2px', transition: 'width 200ms ease, background 200ms ease' }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: strength.color, minWidth: '44px' }}>{strength.label}</span>
              </div>
            )}
            <Text className={styles.hint}>Minimum 8 characters. Mix uppercase, numbers, and symbols for a stronger password.</Text>

            <Field label="Confirm password">
              <Input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </Field>

            {error && <div className={styles.error}>{error}</div>}

            <Button
              type="submit"
              appearance="primary"
              disabled={status === 'loading' || !password || !confirm}
              className={styles.submitBtn}
            >
              {status === 'loading' ? <Spinner size="tiny" /> : 'Set password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
