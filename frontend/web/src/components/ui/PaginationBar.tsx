'use client';
import { makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 0',
    fontSize: '13px',
    color: 'var(--color-text-muted)',
  },
  btn: {
    padding: '4px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
  },
});

interface Props {
  page: number;
  total: number;
  onChange: (page: number) => void;
}

export function PaginationBar({ page, total, onChange }: Props) {
  const styles = useStyles();
  if (total <= 1) return null;
  return (
    <div className={styles.bar}>
      <button className={styles.btn} disabled={page === 0} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>Page {page + 1} of {total}</span>
      <button className={styles.btn} disabled={page >= total - 1} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
