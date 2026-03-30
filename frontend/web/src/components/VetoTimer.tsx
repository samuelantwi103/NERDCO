'use client';
import { Text, makeStyles, mergeClasses } from '@fluentui/react-components';
import { useVetoTimer } from '@/lib/hooks/useVetoTimer';
import { useEffect } from 'react';

const useStyles = makeStyles({
  wrap:   { display: 'flex', alignItems: 'center', gap: '8px' },
  label:  { fontSize: '12px', color: 'var(--color-text-muted)' },
  count:  { fontWeight: '700', fontSize: '20px', fontVariantNumeric: 'tabular-nums' },
  urgent: { color: 'var(--color-fire)' },
  ok:     { color: 'var(--color-text)' },
});

interface Props {
  dispatchedAt: string;
  windowSecs?: number;
  /** Difference (ms) between server time and client time: Date.parse(incident.created_at) - Date.now() */
  clockDeltaMs?: number;
  onExpire?: () => void;
}

export function VetoTimer({ dispatchedAt, windowSecs, clockDeltaMs = 0, onExpire }: Props) {
  const styles = useStyles();
  const { remaining, expired } = useVetoTimer(dispatchedAt, windowSecs, clockDeltaMs);
  useEffect(() => { if (expired) onExpire?.(); }, [expired, onExpire]);

  if (expired) {
    return (
      <div className={styles.wrap}>
        <Text className={styles.label}>Override window</Text>
        <Text className={mergeClasses(styles.count, styles.urgent)}>Expired</Text>
      </div>
    );
  }

  const isUrgent = remaining <= 10;

  return (
    <div className={styles.wrap}>
      <Text className={styles.label}>Override in</Text>
      {/* pulse-red is a plain CSS class from globals.css — applied via style prop to avoid mergeClasses conflict */}
      <Text
        className={mergeClasses(styles.count, isUrgent ? styles.urgent : styles.ok)}
        style={isUrgent ? { animation: 'pulse-red 1s ease-in-out infinite' } : undefined}
      >
        {remaining}s
      </Text>
    </div>
  );
}
