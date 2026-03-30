'use client';
import { Badge } from '@fluentui/react-components';

type IncidentStatus = 'created' | 'dispatched' | 'in_progress' | 'resolved' | 'cancelled';
type VehicleStatus  = 'available' | 'dispatched' | 'unavailable';

const INCIDENT_COLORS: Record<IncidentStatus, React.ComponentProps<typeof Badge>['color']> = {
  created:     'warning',
  dispatched:  'informative',
  in_progress: 'danger',
  resolved:    'success',
  cancelled:   'subtle',
};

const VEHICLE_COLORS: Record<VehicleStatus, React.ComponentProps<typeof Badge>['color']> = {
  available:   'success',
  dispatched:  'warning',
  unavailable: 'danger',
};

const INCIDENT_LABELS: Record<IncidentStatus, string> = {
  created:     'Created',
  dispatched:  'Dispatched',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  cancelled:   'Cancelled',
};

const VEHICLE_LABELS: Record<VehicleStatus, string> = {
  available:   'Available',
  dispatched:  'Dispatched',
  unavailable: 'Unavailable',
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge
      className="status-badge"
      color={INCIDENT_COLORS[status] ?? 'subtle'}
      appearance="tint"
      size="medium"
    >
      {INCIDENT_LABELS[status] ?? status}
    </Badge>
  );
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <Badge
      className="status-badge"
      color={VEHICLE_COLORS[status] ?? 'subtle'}
      appearance="tint"
      size="medium"
    >
      {VEHICLE_LABELS[status] ?? status}
    </Badge>
  );
}
