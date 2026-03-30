'use client';
/**
 * SectionCard — white card container with optional title and header actions.
 * SRP: layout shell only; content via children.
 */
import { makeStyles, Text } from '@fluentui/react-components';
import type { ReactNode } from 'react';

const useStyles = makeStyles({
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-xs)',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  title: { fontWeight: '600', fontSize: '14px' },
  body: { padding: '16px 18px' },
  noPad: { padding: 0 },
});

interface Props {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}

export function SectionCard({ title, actions, children, noPadding }: Props) {
  const styles = useStyles();
  return (
    <div className={styles.card}>
      {(title || actions) && (
        <div className={styles.header}>
          {title && <Text className={styles.title}>{title}</Text>}
          {actions && <div style={{ display: 'flex', gap: '8px' }}>{actions}</div>}
        </div>
      )}
      <div className={noPadding ? styles.noPad : styles.body}>{children}</div>
    </div>
  );
}
