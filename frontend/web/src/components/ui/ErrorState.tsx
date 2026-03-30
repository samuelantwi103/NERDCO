'use client';
/**
 * ErrorState — consistent error placeholder with optional retry action.
 * SRP: only renders an error message and optional retry button; no data logic.
 */
import { makeStyles } from '@fluentui/react-components';
import { ErrorCircleRegular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '48px 24px',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
  },
  msg: { fontSize: '14px', maxWidth: '320px' },
  btn: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
});

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong.', onRetry }: Props) {
  const styles = useStyles();
  return (
    <div className={styles.wrap}>
      <ErrorCircleRegular fontSize={32} style={{ color: 'var(--color-danger)' }} />
      <span className={styles.msg}>{message}</span>
      {onRetry && (
        <button className={styles.btn} onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}
