'use client';
/**
 * PageShell — standard page wrapper with a header row (title + optional actions)
 * and a scrollable content area.
 *
 * SOLID / SRP: owns only layout concerns; passes content through children/actions.
 */
import { makeStyles, Text, Spinner } from '@fluentui/react-components';
import type { ReactNode } from 'react';
import { LastUpdated } from './LastUpdated';
import { ErrorState } from './ErrorState';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    background: 'var(--color-bg)',
  },
  header: {
    padding: '20px 24px 0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexShrink: 0,
  },
  titleBlock: { display: 'flex', flexDirection: 'column', gap: '3px' },
  title: { fontWeight: '700', fontSize: '20px', letterSpacing: '-0.3px', lineHeight: '1.2' },
  subtitle: { fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.4' },
  actions: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingTop: '2px' },
  divider: {
    height: '1px',
    background: 'var(--color-border)',
    margin: '16px 24px 0',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: '20px 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  loadingOverlay: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '80px 0',
  },
});

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  noPadding?: boolean;   // for full-bleed layouts like maps
  lastUpdated?: Date | null;
  refreshing?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PageShell({ title, subtitle, actions, children, loading, noPadding, lastUpdated, refreshing, error, onRetry }: Props) {
  const styles = useStyles();
  return (
    <div className={styles.root} suppressHydrationWarning>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <Text className={styles.title}>{title}</Text>
          {subtitle && <Text className={styles.subtitle}>{subtitle}</Text>}
        </div>
        <div className={styles.actions}>
          <LastUpdated date={lastUpdated ?? null} refreshing={refreshing} />
          {actions}
        </div>
      </div>
      <div className={styles.divider} />
      {noPadding ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {error ? <div style={{padding: '40px'}}><ErrorState message={error} onRetry={onRetry} /></div> : loading ? <div className={styles.loadingOverlay}><Spinner /></div> : children}
        </div>
      ) : (
        <div className={styles.content}>
          {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <div className={styles.loadingOverlay}><Spinner label="Loading…" /></div> : children}
        </div>
      )}
    </div>
  );
}
