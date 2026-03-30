import { Button, Text, Spinner } from '@fluentui/react-components';
import { CheckmarkCircleRegular, ArrowSyncRegular } from '@fluentui/react-icons';
import { VetoTimer } from '@/components/VetoTimer';

interface DispatchResultProps {
  result: any;
  assignedVehicle: any;
  overriding: boolean;
  clockDeltaMs?: number;
  onOverride: (vehicleId: string) => void;
  onDone: () => void;
}

export function DispatchResult({ result, assignedVehicle, overriding, clockDeltaMs = 0, onOverride, onDone }: DispatchResultProps) {
  const { incident, destination_hospital, alternative_responders = [], dispatch_override_window_secs = 30 } = result;
  const dispatchedAt = incident?.dispatched_at ?? incident?.updated_at ?? incident?.created_at;

  const plateName = assignedVehicle
    ? `${assignedVehicle.license_plate} (${assignedVehicle.vehicle_type?.replace(/_/g, ' ')})`
    : incident?.assigned_unit_id ? '…' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#F0FFF0', border: '1px solid #107C10', borderRadius: '8px' }}>
        <CheckmarkCircleRegular style={{ color: '#107C10', fontSize: '22px', flexShrink: 0 }} />
        <Text style={{ fontWeight: '600', fontSize: '14px', color: '#107C10' }}>Incident dispatched</Text>
      </div>

      {plateName ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 16px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>Assigned unit</Text>
              <Text style={{ fontWeight: '700', fontSize: '15px' }}>{plateName}</Text>
              {assignedVehicle?.distance_km != null && (
                <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{assignedVehicle.distance_km?.toFixed(1) ?? '—'} km away</Text>
              )}
            </div>
            <VetoTimer dispatchedAt={dispatchedAt} windowSecs={dispatch_override_window_secs} clockDeltaMs={clockDeltaMs} />
          </div>

          {destination_hospital && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
              <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>Destination</Text>
              <Text style={{ fontSize: '14px', fontWeight: '600' }}>{destination_hospital.name}</Text>
              {destination_hospital.beds_available != null && (
                <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{destination_hospital.beds_available} beds available</Text>
              )}
            </div>
          )}

          {alternative_responders.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
              <Text style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                Override with
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {alternative_responders.map((v: any) => (
                  <Button
                    key={v.vehicle_id}
                    appearance="secondary"
                    disabled={overriding}
                    icon={overriding ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
                    onClick={() => onOverride(v.vehicle_id)}
                    style={{ justifyContent: 'flex-start', fontSize: '13px' }}
                  >
                    {v.license_plate} — {v.vehicle_type?.replace(/_/g, ' ')} ({v.distance_km?.toFixed(1)} km)
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Text style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No unit available — incident queued.</Text>
      )}

      <Button appearance="secondary" onClick={onDone}>Back to dashboard</Button>
    </div>
  );
}