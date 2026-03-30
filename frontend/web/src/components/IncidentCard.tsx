'use client';
import { useEffect, useState, useRef } from 'react';
import { makeStyles, mergeClasses, Text } from '@fluentui/react-components';
import { IncidentStatusBadge } from './StatusBadge';
import { IncidentTypeChip }    from './IncidentTypeChip';

const useStyles = makeStyles({
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    padding: '12px 16px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'box-shadow 150ms ease, border-color 150ms ease',
    ':hover': { boxShadow: 'var(--shadow-sm)' },
  },
  flash: {
    animation: 'flash-update 2s ease-out',
  },
  row:      { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' },
  title:    { fontWeight: '600', fontSize: '14px', flex: 1 },
  meta:     { fontSize: '12px', color: 'var(--color-text-muted)' },
  critical: { border: '1px solid var(--color-fire-border)' },
  selected: { border: '1px solid var(--gray-950)', boxShadow: '0 0 0 2px var(--gray-950)' },
});

interface Incident {
  id: string;
  incident_type: string;
  status: string;
  location_name?: string;
  citizen_name?: string;
  created_at: string;
  updated_at?: string;
  severity?: string;
  latitude?: string | number;
  longitude?: string | number;
}

interface Props {
  incident: Incident;
  selected?: boolean;
  onClick?: () => void;
  extraUnits?: number;
}

export function IncidentCard({ incident, selected, onClick, extraUnits }: Props) {
  const styles = useStyles();
  const isCritical = incident.severity === 'critical' || incident.status === 'dispatched';
  
  const [flash, setFlash] = useState(false);
  const prevUpdateRef = useRef(incident.updated_at ?? incident.created_at);

  useEffect(() => {
    const currentUpdate = incident.updated_at ?? incident.created_at;
    if (currentUpdate && currentUpdate !== prevUpdateRef.current) {
      setFlash(true);
      prevUpdateRef.current = currentUpdate;
      const t = setTimeout(() => setFlash(false), 2000);
      return () => clearTimeout(t);
    }
  }, [incident.updated_at, incident.created_at]);

  useEffect(() => {
    // Inject keyframes for flash if not exists
    if (!document.getElementById('card-flash-style')) {
      const s = document.createElement('style');
      s.id = 'card-flash-style';
      s.textContent = `@keyframes flash-update { 0% { background-color: var(--color-fire-border); } 100% { background-color: var(--color-surface); } }`;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div id={`incident-card-${incident.id}`}
      className={mergeClasses(styles.card, isCritical ? styles.critical : undefined, selected ? styles.selected : undefined, flash ? styles.flash : undefined)}
      onClick={onClick}
      style={isCritical ? { animation: 'pulse-border-critical 2s ease-in-out infinite' } : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
    >
      <div className={styles.row}>
        <Text className={styles.title}>
          {incident.location_name ||
            (incident.latitude
              ? `${parseFloat(String(incident.latitude)).toFixed(4)}, ${parseFloat(String(incident.longitude)).toFixed(4)}`
              : 'Unknown location')}
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {extraUnits && extraUnits > 1 && (
            <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
              {extraUnits} units
            </span>
          )}
          <IncidentTypeChip type={incident.incident_type} />
        </div>
      </div>
      <div className={styles.row}>
        <Text className={styles.meta}>{incident.citizen_name ?? 'No caller info'}</Text>
        <IncidentStatusBadge status={incident.status as any} />
      </div>
      <Text className={styles.meta}>
        {new Date(incident.created_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </div>
  );
}
