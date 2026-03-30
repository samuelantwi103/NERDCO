'use client';
/**
 * EmptyState — consistent zero-data placeholder.
 * SRP: only renders an empty-state message; no data logic.
 */
import { Text } from '@fluentui/react-components';
import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '56px 24px', gap: '12px', textAlign: 'center',
    }}>
      {icon && (
        <div style={{ fontSize: '32px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
          {icon}
        </div>
      )}
      <Text style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-text-secondary)' }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '320px', lineHeight: '1.6' }}>
          {description}
        </Text>
      )}
      {action && <div style={{ marginTop: '4px' }}>{action}</div>}
    </div>
  );
}
