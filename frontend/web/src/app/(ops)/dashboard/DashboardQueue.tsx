'use client';
import { useEffect, useRef } from 'react';
import { Text, makeStyles } from '@fluentui/react-components';
import { IncidentCard } from '@/components/IncidentCard';
import { EmptyState } from '@/components/ui/EmptyState';

const useStyles = makeStyles({
  queue: {
    width: '320px',
    minWidth: '320px',
    flexShrink: 0,
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 10,
    height: '100%',
  },
  queueHeader: {
    padding: '20px 16px 14px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  queueTitle: { fontWeight: '700', fontSize: '15px' },
  countBadge: {
    background: 'var(--color-fire)',
    color: '#FFF',
    fontSize: '11px',
    fontWeight: '700',
    borderRadius: 'var(--radius-full)',
    padding: '2px 8px',
    minWidth: '22px',
    textAlign: 'center',
  },
  queueList: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '8px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '6px' 
  },
  empty: {
    padding: '40px 16px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '14px'
  },
});

interface DashboardQueueProps {
  incidents: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DashboardQueue({ incidents, selectedId, onSelect }: DashboardQueueProps) {
  const styles = useStyles();
  const listRef = useRef<HTMLDivElement>(null);
  
  // Filter out child incidents so only main incidents show in queue
  const displayIncidents = incidents.filter(i => !i.parent_incident_id);
  const dispatchedCount = displayIncidents.filter(i => i.status === 'dispatched').length;

  useEffect(() => {
    if (selectedId && listRef.current) {
      const el = document.getElementById(`incident-card-${selectedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedId]);

  return (
    <aside className={`${styles.queue} dashboard-panel`}>
      <div className={styles.queueHeader}>
        <Text className={styles.queueTitle}>Open Incidents</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {dispatchedCount > 0 && <span className={styles.countBadge}>{dispatchedCount}</span>}
          <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{displayIncidents.length} total</Text>
        </div>
      </div>
      <div className={styles.queueList} ref={listRef}>
        {displayIncidents.length === 0 ? (
          <EmptyState title="No open incidents" description="All clear — no active incidents in the system." />
        ) : (
          displayIncidents.map(inc => {
            const children = incidents.filter(i => i.parent_incident_id === inc.id);
            const totalUnits = children.length > 0 ? children.length + 1 : undefined;

            return (
              <IncidentCard
                key={inc.id}
                incident={inc}
                selected={inc.id === selectedId}
                onClick={() => onSelect(inc.id)}
                extraUnits={totalUnits}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}
