'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Text, Spinner, makeStyles } from '@fluentui/react-components';
import { EyeRegular, EyeOffRegular } from '@fluentui/react-icons';
import { useAuth, UserRole } from '@/lib/context/AuthContext';

const useStyles = makeStyles({
  page: {
    minHeight: '100vh',
    display: 'flex',
    background: 'var(--color-bg)',
  },
  left: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '32px',
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
  heading:   { fontWeight: '700', fontSize: '24px', letterSpacing: '-0.5px', marginBottom: '6px' },
  subheading:{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  error: {
    padding: '10px 14px',
    background: 'var(--color-fire-bg)',
    border: '1px solid var(--color-fire-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    color: 'var(--color-fire)',
  },
  submitBtn: {
    marginTop: '4px',
    background: 'var(--gray-950)',
    border: 'none',
    minHeight: '48px',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: 'var(--radius-md)',
  },
  forgotBtn: {
    background: 'none', border: 'none',
    fontSize: '13px', color: 'var(--color-text-muted)',
    cursor: 'pointer', textDecoration: 'underline',
    padding: '0', textAlign: 'right',
    ':hover': { color: 'var(--color-text)' },
  },
  devBox: {
    marginTop: '32px',
    border: '1px dashed var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  devHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'var(--color-bg)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  devTitle: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-text-muted)' },
  devHint:  { fontSize: '12px', color: 'var(--color-text-muted)' },
  devList: { display: 'flex', flexDirection: 'column' },
  devItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 14px',
    cursor: 'pointer',
    borderTop: '1px solid var(--color-border)',
    transition: 'background 100ms ease',
    ':hover': { background: 'var(--color-bg)' },
  },
  devName:  { flex: 1, fontSize: '13px', fontWeight: '500' },
  devEmail: { fontSize: '12px', color: 'var(--color-text-muted)', flex: 2 },
  devRole:  {
    fontSize: '11px', fontWeight: '600',
    padding: '2px 6px', borderRadius: 'var(--radius-full)',
    background: 'var(--gray-200)', color: 'var(--gray-600)',
  },
  right: {
    width: '480px',
    background: 'var(--gray-950)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    gap: '24px',
  },
  rightHeading: { fontWeight: '700', fontSize: '26px', color: '#FFF', textAlign: 'center', letterSpacing: '-0.5px', lineHeight: '1.3' },
  rightSub: { fontSize: '14px', color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: '1.6', maxWidth: '320px' },
  featureList: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' },
  featureItem: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
  featureDot: {
    width: '6px', height: '6px',
    borderRadius: '50%', background: 'rgba(255,255,255,0.3)',
    marginTop: '7px', flexShrink: 0,
  },
  featureText: { fontSize: '14px', color: 'rgba(255,255,255,0.80)', lineHeight: '1.5' },
});

const DEV_ACCOUNTS = [
  { name: 'Kwame',        email: 'kwame@nerdco.gov.gh',      role: 'system_admin'    },
  { name: 'Efua',         email: 'efua@nerdco.gov.gh',       role: 'system_admin'    },
  { name: 'Ama — NAS',    email: 'ama@nerdco.gov.gh',        role: 'org_admin'       },
  { name: 'Akosua — Korle Bu', email: 'akosua@nerdco.gov.gh',role: 'org_admin'       },
  { name: '37 Military',  email: 'military@nerdco.gov.gh',   role: 'org_admin'       },
  { name: 'Kaneshie PD',  email: 'kaneshie@nerdco.gov.gh',   role: 'org_admin'       },
  { name: 'Madina PD',    email: 'madina@nerdco.gov.gh',     role: 'org_admin'       },
  { name: 'Circle Fire',  email: 'circle@nerdco.gov.gh',     role: 'org_admin'       },
  { name: 'Accra Fire',   email: 'accrafire@nerdco.gov.gh',  role: 'org_admin'       },
  { name: 'Driver 1',     email: 'driver1@nerdco.gov.gh',    role: 'first_responder' },
];

function rolePath(role: UserRole): string {
  if (role === 'system_admin')    return '/dashboard';
  if (role === 'org_admin')       return '/fleet/dashboard';
  if (role === 'first_responder') return '/field';
  return '/login';
}

const FEATURES = [
  'Unified emergency dispatch across police, fire, and ambulance',
  'Real-time vehicle tracking with WebSocket updates',
  'Intelligent routing to hospitals with available capacity',
  'Multi-agency coordination without phone calls',
];

export default function LoginPage() {
  const styles = useStyles();
  const router = useRouter();
  const { login } = useAuth();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [devOpen,    setDevOpen]    = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const authUser = await login(email, password);
      router.replace(rolePath(authUser.role));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Invalid email or password');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.page}>
      {/* ── Left: form */}
      <div className={styles.left}>
        <div className={styles.card}>
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>N</div>
            <span className={styles.brandName}>NERDCO</span>
          </div>

          <Text className={styles.heading}>Sign in</Text>
          <Text className={styles.subheading}>National Emergency Response &amp; Dispatch Coordination</Text>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <Field label="Email address">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="you@agency.gov.gh"
              />
            </Field>

            <Field label="Password">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                contentAfter={
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
                  >
                    {showPw ? <EyeOffRegular fontSize={16} /> : <EyeRegular fontSize={16} />}
                  </button>
                }
              />
            </Field>

            <button
              type="button"
              className={styles.forgotBtn}
              style={{ alignSelf: 'flex-end', marginTop: '-8px' }}
              onClick={() => router.push('/forgot-password')}
            >
              Forgot password?
            </button>

            {error && <div className={styles.error}>{error}</div>}

            <Button
              type="submit"
              appearance="primary"
              disabled={loading || !email || !password}
              className={styles.submitBtn}
            >
              {loading ? <Spinner size="tiny" /> : 'Sign in'}
            </Button>
          </form>

          {/* Dev accounts */}
          {process.env.NODE_ENV === 'development' && (
            <div className={styles.devBox}>
              <div className={styles.devHeader} onClick={() => setDevOpen(v => !v)}>
                <span className={styles.devTitle}>Dev accounts</span>
                <span className={styles.devHint}>{devOpen ? '▲' : '▼'} all passwords: <code>password</code></span>
              </div>
              {devOpen && (
                <div className={styles.devList}>
                  {DEV_ACCOUNTS.map(a => (
                    <div key={a.email} className={styles.devItem} onClick={() => { setEmail(a.email); setPassword('password'); }}>
                      <span className={styles.devName}>{a.name}</span>
                      <span className={styles.devEmail}>{a.email}</span>
                      <span className={styles.devRole}>{a.role.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: brand panel — hidden on small screens */}
      <div className={styles.right} style={{ display: 'var(--right-panel-display, flex)' } as any}>
        <Text className={styles.rightHeading}>
          Ghana's unified emergency dispatch platform
        </Text>
        <Text className={styles.rightSub}>
          Connecting the National Ambulance Service, Ghana Police, and Fire Service through a single operations centre.
        </Text>
        <div className={styles.featureList}>
          {FEATURES.map(f => (
            <div key={f} className={styles.featureItem}>
              <div className={styles.featureDot} />
              <Text className={styles.featureText}>{f}</Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
