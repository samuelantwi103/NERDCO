const fs = require('fs');
let text = fs.readFileSync('../../frontend/web/src/app/(fleet)/fleet/dashboard/page.tsx', 'utf8');

// Insert import
if (!text.includes('DashboardMap')) {
    text = text.replace(
        "import { useFleetDashboard } from './useFleetDashboard';",
        "import { useFleetDashboard } from './useFleetDashboard';\nimport { DashboardMap } from '@/app/(ops)/dashboard/DashboardMap';"
    );
}

// Replace PageShell layout
const replacement = 
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        <DashboardMap incidents={myIncidents} vehicles={vehicles} selectedId={selectedIncId} onSelect={actions.setSelectedIncId} />
      </div>

      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, display: 'flex', gap: '16px', pointerEvents: 'none' }}>
        <div style={{ flex: 1, pointerEvents: 'none' }}>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', pointerEvents: 'auto' }}>
            <StatCard label="Vehicles"         value={vehicles.length}      />
            <StatCard label="Available"        value={available}            accentColor="var(--color-success)" />
            <StatCard label="Dispatched"       value={dispatched}           accentColor="var(--color-warning)" />
            <StatCard label="Active incidents" value={myIncidents.length}   accentColor="var(--color-medical)" />
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 120, right: 16, bottom: 16, width: '380px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ flex: 1, overflowY: 'auto', pointerEvents: 'auto' }}>
          <SectionCard title="Active incidents">
            {myIncidents.length === 0 ? (
              <EmptyState icon={<AlertUrgentRegular />} title="No active incidents" description="Incidents assigned to your station will appear here." />
            ) : (
              <div>
                {myIncidents.map((inc, i) => {
                  const isSelected = selectedIncId === inc.id;
                  const assignedV  = vehicles.find(v => v.id === inc.assigned_unit_id);
                  const isWithin30s = inc.created_at ? (Date.now() - new Date(inc.created_at).getTime() <= 30000) : false;
                  return (
                    <div key={inc.id} className={styles.incidentRow} style={i === myIncidents.length - 1 ? { borderBottom: 'none' } : {}}>
                      <div className={styles.incidentHeader} onClick={() => actions.setSelectedIncId(isSelected ? null : inc.id)}>
                        <Text className={styles.incidentTitle}>{inc.location_name ?? 'Incident'}</Text>
                        <IncidentTypeChip type={inc.incident_type} />
                        <IncidentStatusBadge status={inc.status} />
                      </div>
                      
                      {isSelected && (
                        <div style={{ marginTop: '8px', padding: '12px', background: 'var(--color-bg)', borderRadius: '8px' }}>
                          <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Assigned: {assignedV?.license_plate ?? 'None'}</Text>
                          {availableVehicles.length > 0 && availableVehicles.map(v => (
                            <button key={v.id} className={styles.altBtn} onClick={() => actions.overrideIncident(inc.id, v.id)} disabled={overriding}>
                              <ArrowSyncRegular /> Override with {v.license_plate}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', pointerEvents: 'auto' }}>
          <SectionCard title="Your vehicles">
            {vehicles.length === 0 ? (
              <EmptyState icon={<VehicleCarRegular />} title="No vehicles" description="Add vehicles from the Vehicles page." />
            ) : (
              <div>
                {vehicles.slice(0, 10).map((v, i) => (
                  <div key={v.id} className={styles.vehicleRow} style={i === Math.min(vehicles.length, 10) - 1 ? { borderBottom: 'none' } : {}}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <Text style={{ fontWeight: '600', fontSize: '14px' }}>{v.license_plate}</Text>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'capitalize', marginTop: '2px' }}>
                        {v.vehicle_type?.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <VehicleStatusBadge status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
;

text = text.replace(/  return \(\n    \<PageShell[\s\S]*?\n\}/, replacement);
fs.writeFileSync('../../frontend/web/src/app/(fleet)/fleet/dashboard/page.tsx', text);
