'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { makeStyles } from '@fluentui/react-components';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { useDashboardState } from './useDashboardState';
import { DashboardQueue } from './DashboardQueue';
import { DashboardDetail } from './DashboardDetail';
import { DashboardMap } from './DashboardMap';
import { ErrorState } from '@/components/ui/ErrorState';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'row', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--color-bg)', position: 'relative' },
});

const TOGGLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '0 6px 6px 0',
  width: '20px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  boxShadow: 'var(--shadow-sm)',
  userSelect: 'none',
};

function DashboardContent() {
  const styles = useStyles();
  const { user } = useAuth();
  const { notifySuccess } = useToast();
  const token = user?.access_token ?? '';
  const params = useSearchParams();

  const [queueOpen,  setQueueOpen]  = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);

  const {
    incidents, vehicles, selectedId, detail,
    statusBusy, overriding, error,
    selectIncident, handleStatusUpdate, handleOverride
  } = useDashboardState(token, { success: notifySuccess });

  // Auto-select a highlighted incident (e.g. redirected from duplicate detection)
  useEffect(() => {
    const highlightId = params.get('highlight');
    if (highlightId && incidents.length > 0) {
      const found = incidents.find(i => i.id === highlightId);
      if (found) {
        selectIncident(highlightId);
        notifySuccess('Duplicate detected', 'An open incident already exists at this location.');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents.length]);

  // When an incident is selected, auto-open the detail panel
  useEffect(() => {
    if (selectedId) setDetailOpen(true);
  }, [selectedId]);

  return (
    <div className={styles.root}>
      {error && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 30 }}>
          <ErrorState message={error} />
        </div>
      )}

      {/* Queue panel + its toggle */}
      {queueOpen && (
        <DashboardQueue
          incidents={incidents}
          selectedId={selectedId}
          onSelect={selectIncident}
        />
      )}
      {/* Queue toggle tab — pinned to right edge of queue (or left edge of map) */}
      <div
        style={{
          ...TOGGLE_STYLE,
          left: queueOpen ? '320px' : 0,
          borderRadius: queueOpen ? '0 6px 6px 0' : '6px',
        }}
        onClick={() => setQueueOpen(o => !o)}
        title={queueOpen ? 'Hide queue' : 'Show queue'}
      >
        {queueOpen ? '◀' : '▶'}
      </div>

      {/* Map — fills remaining space */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <DashboardMap
          incidents={selectedId && detail ? incidents.filter(i => i.id === selectedId || i.parent_incident_id === detail.id) : incidents}
          vehicles={vehicles}
          selectedId={selectedId}
          onSelect={selectIncident}
          hidePOIs={true}
        />
      </div>

      {/* Detail toggle tab — pinned to left edge of detail panel */}
      <div
        style={{
          ...TOGGLE_STYLE,
          right: detailOpen ? '320px' : 0,
          left: 'auto',
          borderRadius: detailOpen ? '6px 0 0 6px' : '6px',
        }}
        onClick={() => setDetailOpen(o => !o)}
        title={detailOpen ? 'Hide detail' : 'Show detail'}
      >
        {detailOpen ? '▶' : '◀'}
      </div>

      {/* Detail panel */}
      {detailOpen && (
        <DashboardDetail
          detail={detail}
          vehicles={vehicles}
          statusBusy={statusBusy}
          overriding={overriding}
          onStatusUpdate={handleStatusUpdate}
          onOverride={handleOverride}
          relatedIncidents={incidents.filter(i => i.parent_incident_id === detail?.id)}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
