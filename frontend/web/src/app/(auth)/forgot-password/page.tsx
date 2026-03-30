'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button, Field, Input, Text, Spinner,
  makeStyles,
} from '@fluentui/react-components';
import { forgotPassword } from '@/lib/api/auth';

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
  submitBtn: {
    marginTop: '4px',
    background: 'var(--gray-950)',
    border: 'none',
    height: '42px',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: 'var(--radius-md)',
  },
  backLink: {
    fontSize: '13px',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    cursor: 'pointer',
    textDecoration: 'underline',
    background: 'none',
    border: 'none',
    padding: 0,
  },
});

export default function ForgotPasswordPage() {
  const styles = useStyles();
  const router = useRouter();

  const [email,   setEmail]   = useState('');
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'sent'>('idle');
  const [error,   setError]   = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('loading');
    try {
      await forgotPassword(email);
      setStatus('sent');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Try again.');
      setStatus('idle');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <div className={styles.brandMark}>N</div>
          <span className={styles.brandName}>NERDCO</span>
        </div>

        <Text className={styles.heading}>Reset password</Text>
        <Text className={styles.subtitle}>
          Enter your email address and we&apos;ll send a reset link.
        </Text>

        {status === 'sent' ? (
          <div className={styles.success}>
            If that email is registered, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Email address">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@agency.gov.gh"
              />
            </Field>

            {error && <div className={styles.error}>{error}</div>}

            <Button
              type="submit"
              appearance="primary"
              disabled={status === 'loading' || !email}
              className={styles.submitBtn}
            >
              {status === 'loading' ? <Spinner size="tiny" /> : 'Send reset link'}
            </Button>
          </form>
        )}

        <button type="button" className={styles.backLink} onClick={() => router.push('/login')}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}
