'use client';
/**
 * StatCard — single metric display (value + label + optional accent colour).
 * SRP: only displays one KPI; no data-fetching.
 */
import { makeStyles, Text } from '@fluentui/react-components';

const useStyles = makeStyles({
  card: {
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: 'var(--shadow-xs)',
    transition: 'box-shadow 150ms ease',
    ':hover': { boxShadow: 'var(--shadow-sm)' },
  },
  value: { fontWeight: '700', fontSize: '32px', letterSpacing: '-0.5px', lineHeight: '1' },
  label: { fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '500' },
  subtitle: { fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '400', marginTop: '-4px' },
  accent: { 
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px'
  },
});

interface Props {
  label: string;
  value: number | string;
  accentColor?: string;
  subtitle?: string;
}

export function StatCard({ label, value, accentColor, subtitle }: Props) {
  const styles = useStyles();
  return (
    <div className={styles.card}>
      {accentColor && <div className={styles.accent} style={{ background: accentColor }} />}
      <Text className={styles.value}>{value}</Text>
      <Text className={styles.label}>{label}</Text>
      {subtitle && <Text className={styles.subtitle}>{subtitle}</Text>}
    </div>
  );
}
