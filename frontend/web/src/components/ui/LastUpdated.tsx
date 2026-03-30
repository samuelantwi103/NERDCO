'use client';
import { useEffect, useState } from 'react';

interface Props {
  date: Date | null;
  refreshing?: boolean;
}

export function LastUpdated({ date, refreshing }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!date && !refreshing) return null;

  const label = refreshing
    ? 'Refreshing…'
    : date
      ? `Updated ${Math.round((Date.now() - date.getTime()) / 1000)}s ago`
      : '';

  return (
    <span style={{
      fontSize: '12px',
      fontStyle: 'italic',
      color: 'var(--color-text-muted)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
    }}>
      {refreshing && (
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-text-muted)',
          animation: 'pulse 1s infinite',
        }} />
      )}
      {label}
    </span>
  );
}
