'use client';
import { makeStyles } from '@fluentui/react-components';
import { CheckmarkCircleRegular, ErrorCircleRegular, DismissRegular } from '@fluentui/react-icons';
import type { Toast } from '@/lib/hooks/useToast';

const useStyles = makeStyles({
  container: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 9999,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: '13px',
    fontWeight: '500',
    minWidth: '240px',
    maxWidth: '360px',
    animation: 'slideIn 0.2s ease',
  },
  success: {
    background: 'var(--color-success-bg, #F0FFF4)',
    border: '1px solid var(--color-success-border, #86EFAC)',
    color: 'var(--color-success-text, #166534)',
  },
  error: {
    background: 'var(--color-fire-bg, #FFF1F2)',
    border: '1px solid var(--color-fire-border, #FDA4AF)',
    color: '#991B1B',
  },
  info: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  },
  dismiss: {
    marginLeft: 'auto',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'inherit',
    opacity: 0.6,
  },
});

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  const styles = useStyles();
  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.variant]}`}>
          {t.variant === 'success' && <CheckmarkCircleRegular fontSize={16} />}
          {t.variant === 'error' && <ErrorCircleRegular fontSize={16} />}
          {t.message}
          <button className={styles.dismiss} onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <DismissRegular fontSize={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
