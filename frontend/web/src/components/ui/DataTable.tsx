'use client';
/**
 * DataTable — generic, styled table wrapper.
 * ISP: accepts only the column/row data it needs; callers compose cell rendering.
 */
import { makeStyles, Text } from '@fluentui/react-components';
import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

const useStyles = makeStyles({
  wrap: {
    width: '100%',
    overflowX: 'auto',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-xs)',
  },
  table: { width: '100%', borderCollapse: 'collapse' as any },
  th: {
    textAlign: 'left' as any,
    padding: '10px 16px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.5px',
    background: 'var(--color-bg)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
  },
  tr: {
    transition: 'background 100ms ease',
    ':hover': { background: 'var(--color-bg)' },
  },
  td: {
    padding: '11px 16px',
    fontSize: '13.5px',
    borderBottom: '1px solid var(--color-border)',
    verticalAlign: 'middle',
  },
  lastTr: { borderBottom: 'none' },
});

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T, index: number) => ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({ columns, rows, rowKey, emptyTitle = 'No data', emptyDescription }: Props<T>) {
  const styles = useStyles();
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className={styles.th} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row)} className={styles.tr}>
              {columns.map(col => (
                <td
                  key={col.key}
                  className={styles.td}
                  style={i === rows.length - 1 ? { borderBottom: 'none' } : undefined}
                >
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}
