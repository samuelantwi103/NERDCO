'use client';
/**
 * SkeletonCard — animated shimmer placeholder for loading states.
 * SRP: renders a shimmer skeleton with configurable lines; no data logic.
 * Use in place of spinners for content areas where layout is predictable.
 */
import { makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
  },
  line: {
    borderRadius: 'var(--radius-sm)',
    background: 'linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-shimmer 1.4s ease infinite',
  },
});

interface Props {
  lines?: number;
  height?: number;
}

export function SkeletonCard({ lines = 3, height = 18 }: Props) {
  const styles = useStyles();

  const widths = ['75%', '55%', '90%', '40%', '65%'];

  return (
    <div className={styles.card}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={styles.line}
          style={{ height: `${height}px`, width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}
