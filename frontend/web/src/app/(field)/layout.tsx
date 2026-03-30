'use client';
import { useEffect } from 'react';
import { makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
  shell: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    display: 'flex',
    flexDirection: 'column',
  },
});

// No sidebar for field view — one screen, one action.
export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const styles = useStyles();

  // Register field-scoped PWA service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/field-sw.js', { scope: '/field' })
        .catch(() => {/* SW registration is best-effort */});
    }
  }, []);

  return (
    <>
      {/* PWA manifest — only injected for field routes */}
      <link rel="manifest" href="/field-manifest.json" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="theme-color" content="#FAFAFA" />
      <div className={styles.shell}>{children}</div>
    </>
  );
}
