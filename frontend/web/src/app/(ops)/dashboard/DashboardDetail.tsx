'use client';
import { Text, Button, Divider, Spinner, makeStyles } from '@fluentui/react-components';
import { ArrowSyncRegular, CheckmarkCircleRegular, ArrowForwardRegular } from '@fluentui/react-icons';
import { IncidentStatusBadge } from '@/components/StatusBadge';
import { IncidentTypeChip } from '@/components/IncidentTypeChip';
import { VetoTimer } from '@/components/VetoTimer';
import { EmptyState } from '@/components/ui/EmptyState';

const useStyles = makeStyles({
    detail: { 
        width: '320px', 
        minWidth: '320px',
        flexShrink: 0,
        background: 'var(--color-surface)', 
        borderLeft: '1px solid var(--color-border)', 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        zIndex: 10,
        height: '100%',
    },
    detailInner: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 },
    detailHeader: { display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' },
    detailTitle: { fontWeight: '700', fontSize: '18px', letterSpacing: '-0.2px', flex: 1 },
    metaGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '8px' },
    metaCard: { background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 10px' },
    metaLabel: { fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px', display: 'block' },
    metaValue: { fontSize: '13px', fontWeight: '500' },
    actionBar: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    unitBox: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--shadow-xs)' },
    unitBoxHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
    unitLabel: { fontSize: '10.5px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '3px' },
    unitName: { fontWeight: '700', fontSize: '16px' },
    altGrid: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' },
    altBtn: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
        transition: 'border-color 120ms ease, background 120ms ease',
        ':hover': { background: 'var(--color-surface)' },
        ':disabled': { opacity: 0.5, cursor: 'not-allowed' },
    },
    placeholder: { 
        width: '320px', 
        minWidth: '320px',
        background: 'var(--color-surface)', 
        borderLeft: '1px solid var(--color-border)', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '12px', 
        color: 'var(--color-text-muted)', 
        padding: '30px', 
        zIndex: 10,
        height: '100%',
    },
});

interface DashboardDetailProps {
    detail: any;
    vehicles: any[];
    relatedIncidents?: any[];
    organizations?: any[];
    statusBusy: boolean;
    overriding: boolean;
    onStatusUpdate: (status: string) => void;
    onOverride: (vehicleId: string) => void;
}

export function DashboardDetail({ detail, vehicles, relatedIncidents, organizations, statusBusy, overriding, onStatusUpdate, onOverride }: DashboardDetailProps) {
    const styles = useStyles();

    if (!detail) {
        return (
            <div className={`${styles.placeholder} dashboard-panel`}>
                <div style={{ fontSize: '40px', opacity: 0.15 }}>📋</div>
                <Text style={{ fontWeight: '600', color: 'var(--color-text-secondary)' }}>Select an incident</Text>
                <Text style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '240px' }}>
                    Click any incident in the queue to view details and manage dispatch
                </Text>
            </div>
        );
    }

    if (detail._closed) {
        return (
            <section className={`${styles.detail} dashboard-panel`}>
                <div className={styles.detailInner}>
                    <EmptyState
                        title="This incident has already been closed."
                        description={`Status: ${detail.status}`}
                    />
                </div>
            </section>
        );
    }

    // Collect all dispatched units: parent incident + each related child
    const allUnitIds = [
        detail.assigned_unit_id,
        ...(relatedIncidents ?? []).map((i: any) => i.assigned_unit_id),
    ].filter(Boolean) as string[];

    const assignedVehicle = detail.assigned_unit_id
        ? vehicles.find(v => v.id === detail.assigned_unit_id)
        : null;

    const alternatives = vehicles
        .filter(v => v.status === 'available' && !allUnitIds.includes(v.id))
        .slice(0, 4);

    return (
        <section className={styles.detail}>
            <div className={styles.detailInner}>
                <div className={styles.detailHeader}>
                    <Text className={styles.detailTitle}>{detail.location_name ?? 'Incident'}</Text>
                    <IncidentTypeChip type={detail.incident_type} />
                    <IncidentStatusBadge status={detail.status} />
                </div>
                <Divider />
                <div className={styles.metaGrid}>
                    <div className={styles.metaCard}>
                        <span className={styles.metaLabel}>Caller</span>
                        <Text className={styles.metaValue}>{detail.citizen_name ?? '—'}</Text>
                    </div>
                    <div className={styles.metaCard}>
                        <span className={styles.metaLabel}>Reported</span>
                        <Text className={styles.metaValue}>
                            {new Date(detail.created_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </div>
                    {detail.notes && (
                        <div className={styles.metaCard} style={{ gridColumn: '1 / -1' }}>
                            <span className={styles.metaLabel}>Notes</span>
                            <Text className={styles.metaValue} style={{ whiteSpace: 'pre-wrap' }}>{detail.notes}</Text>
                        </div>
                    )}
                    {(detail.latitude || detail.longitude) && (
                        <div className={styles.metaCard} style={{ gridColumn: '1 / -1' }}>
                            <span className={styles.metaLabel}>Coordinates</span>
                            <Text className={styles.metaValue} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {parseFloat(detail.latitude).toFixed(5)}, {parseFloat(detail.longitude).toFixed(5)}
                            </Text>
                        </div>
                    )}
                </div>

                {/* Destination hospital (when in_progress) */}
                {detail.destination_hospital_id && (() => {
                    const hospital = organizations?.find((o: any) => o.id === detail.destination_hospital_id);
                    return hospital ? (
                        <div className={styles.metaCard} style={{ borderLeft: '3px solid var(--color-available)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className={styles.metaLabel} style={{ color: 'var(--color-available)' }}>Destination Hospital</span>
                            <Text className={styles.metaValue}>{hospital.name}</Text>
                            {hospital.address && <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{hospital.address}</Text>}
                        </div>
                    ) : null;
                })()}

                {/* MCI: all dispatched units (parent + children) */}
                {allUnitIds.length > 1 && (
                    <div style={{ background: 'var(--color-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <span className={styles.unitLabel}>Dispatched Units ({allUnitIds.length})</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                            {[{ id: detail.id, assigned_unit_id: detail.assigned_unit_id, status: detail.status }, ...(relatedIncidents ?? [])].map((inc: any) => {
                                const v = vehicles.find((x: any) => x.id === inc.assigned_unit_id);
                                return (
                                    <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <IncidentStatusBadge status={inc.status} />
                                        <span style={{ fontWeight: 600, marginLeft: '8px', flex: 1, textAlign: 'right' }}>
                                            {v ? `${v.license_plate} · ${v.vehicle_type?.replace(/_/g, ' ')}` : (inc.assigned_unit_id ?? 'Unassigned')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className={styles.actionBar}>
                    {(detail.status === 'dispatched' || detail.status === 'in_progress') && (
                        <Button appearance="primary" disabled={statusBusy} icon={statusBusy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />}
                            style={{ background: 'var(--color-success)', border: 'none' }} onClick={() => onStatusUpdate('resolved')}>
                            Mark Resolved
                        </Button>
                    )}
                    {detail._closed && (
                        <Text style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                            This incident has been resolved. No further actions can be taken.
                        </Text>
                    )}
                </div>

                {(detail.status === 'dispatched' || detail.status === 'in_progress') && (
                    <div className={styles.unitBox}>
                        <div className={styles.unitBoxHeader}>
                            <div>
                                <span className={styles.unitLabel}>Assigned unit</span>
                                <Text className={styles.unitName}>
                                    {assignedVehicle ? `${assignedVehicle.license_plate} · ${assignedVehicle.vehicle_type?.replace(/_/g, ' ')}` : detail.assigned_unit_id}
                                </Text>
                            </div>
                            <VetoTimer dispatchedAt={detail.dispatched_at ?? detail.updated_at} />
                        </div>
                        {alternatives.length > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <span className={styles.unitLabel}>Override with available unit</span>
                                    <div className={styles.altGrid}>
                                        {alternatives.map(v => (
                                            <button key={v.id} className={styles.altBtn} onClick={() => onOverride(v.id)} disabled={overriding}>
                                                <ArrowSyncRegular fontSize={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                                <span style={{ flex: 1, textAlign: 'left' }}>
                                                    {v.license_plate}
                                                    <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>{v.vehicle_type?.replace(/_/g, ' ')}</span>
                                                </span>
                                                {overriding && <Spinner size="tiny" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {(detail.status === 'created' || detail.status === 'pending') && (
                    <div className={styles.unitBox} style={{ border: '1px solid var(--color-fire)', background: 'var(--color-fire-muted, #fff5f5)' }}>
                        <div className={styles.unitBoxHeader}>
                            <div>
                                <span className={styles.unitLabel} style={{ color: 'var(--color-fire)' }}>Awaiting Units</span>
                                <Text className={styles.unitName}>
                                    No unit was assigned initially
                                </Text>
                            </div>
                        </div>
                        {alternatives.length > 0 ? (
                            <>
                                <Divider />
                                <div>
                                    <span className={styles.unitLabel}>Assign an available unit</span>
                                    <div className={styles.altGrid}>
                                        {alternatives.map(v => (
                                            <button key={v.id} className={styles.altBtn} onClick={() => onOverride(v.id)} disabled={overriding}>
                                                <ArrowForwardRegular fontSize={14} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                                                <span style={{ flex: 1, textAlign: 'left' }}>
                                                    {v.license_plate}
                                                    <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>{v.vehicle_type?.replace(/_/g, ' ')}</span>
                                                </span>
                                                {overriding && <Spinner size="tiny" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <Text style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                                All fleet units are currently busy.
                            </Text>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
