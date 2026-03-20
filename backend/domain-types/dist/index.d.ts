export type UserRole = 'system_admin' | 'org_admin' | 'first_responder';
export type OrgType = 'hospital' | 'ambulance_service' | 'police_station' | 'fire_station';
export type IncidentType = 'medical' | 'fire' | 'robbery' | 'crime';
export type VehicleType = 'ambulance' | 'police_car' | 'fire_truck';
export type VehicleStatus = 'available' | 'dispatched' | 'unavailable';
export interface JwtAccessPayload {
    sub: string;
    role: UserRole;
    org?: string | null;
    org_type?: OrgType | null;
    iat?: number;
    exp?: number;
}
export interface JwtRefreshPayload {
    sub: string;
    iat?: number;
    exp?: number;
}
export interface VehicleModel {
    id: string;
    organization_id: string;
    organization_type: string;
    vehicle_type: VehicleType;
    license_plate: string;
    driver_user_id?: string | null;
    status: VehicleStatus;
    current_incident_id?: string | null;
    latitude: number | null;
    longitude: number | null;
    last_updated?: string;
}
export type IncidentEventRoutingKey = 'incident.created' | 'incident.dispatched' | 'incident.in_progress' | 'incident.resolved';
export type VehicleEventRoutingKey = 'vehicle.location.updated' | 'vehicle.status.changed';
export type HospitalEventRoutingKey = 'hospital.capacity_updated';
export type EventRoutingKey = IncidentEventRoutingKey | VehicleEventRoutingKey | HospitalEventRoutingKey;
export interface IncidentCreatedPayload {
    incident_id: string;
    citizen_name: string;
    incident_type: IncidentType;
    latitude: number;
    longitude: number;
    notes?: string | null;
    created_by: string;
    created_at: string;
}
export interface IncidentDispatchedPayload {
    incident_id: string;
    incident_type?: IncidentType;
    latitude?: number;
    longitude?: number;
    assigned_unit_id: string;
    assigned_unit_type?: VehicleType;
    distance_km?: number;
    dispatched_at: string;
    override?: boolean;
}
export interface IncidentStatusPayload {
    incident_id: string;
    changed_by: string;
    in_progress_at?: string;
    resolved_at?: string;
}
export interface VehicleLocationUpdatedPayload {
    vehicle_id: string;
    vehicle_type: VehicleType;
    status: VehicleStatus;
    latitude: number;
    longitude: number;
    recorded_at: string;
}
export interface VehicleStatusChangedPayload {
    vehicle_id: string;
    vehicle_type: VehicleType;
    organization_id: string;
    old_status?: VehicleStatus;
    new_status: VehicleStatus;
    current_incident_id?: string | null;
    changed_at: string;
}
export interface HospitalCapacityUpdatedPayload {
    hospital_id: string;
    hospital_name: string;
    beds_available: number;
    beds_total: number;
    updated_at: string;
}
export interface EventEnvelope<TPayload> {
    event_id: string;
    event: EventRoutingKey;
    version: '1.0';
    timestamp: string;
    payload: TPayload;
}
