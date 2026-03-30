'use client';
import { useEffect, Suspense } from 'react';
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
  root: { display: 'flex', flexDirection: 'row', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--color-bg)' },
});

function DashboardContent() {
  const styles = useStyles();
  const { user } = useAuth();
  const { notifySuccess } = useToast();
  const token = user?.access_token ?? '';
  const params = useSearchParams();

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

  return (
    <div className={styles.root}>
      {error && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }}>
          <ErrorState message={error} />
        </div>
      )}
      
      <DashboardQueue
        incidents={incidents}
        selectedId={selectedId}
        onSelect={selectIncident}
      />
      <DashboardMap
        incidents={selectedId && detail ? incidents.filter(i => i.id === selectedId || i.parent_incident_id === detail.id) : incidents}
        vehicles={vehicles}
        selectedId={selectedId}
        onSelect={selectIncident}
        hidePOIs={true}
      />
      <DashboardDetail
        detail={detail}
        vehicles={vehicles}
        statusBusy={statusBusy}
        overriding={overriding}
        onStatusUpdate={handleStatusUpdate}
        onOverride={handleOverride}
        relatedIncidents={incidents.filter(i => i.parent_incident_id === detail?.id)}
      />
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

