class Incident {
  final String id;
  final String type;
  final String status;
  final double latitude;
  final double longitude;
  final String? locationName;
  final String? citizenName;
  final String? notes;
  final String? assignedVehicleId;
  final String? parentIncidentId;
  final String? destinationHospitalId;
  final String? destinationHospitalName;
  final DateTime createdAt;

  const Incident({
    required this.id,
    required this.type,
    required this.status,
    required this.latitude,
    required this.longitude,
    this.locationName,
    this.citizenName,
    this.notes,
    this.assignedVehicleId,
    this.parentIncidentId,
    this.destinationHospitalId,
    this.destinationHospitalName,
    required this.createdAt,
  });

    factory Incident.fromJson(Map<String, dynamic> j) => Incident(
    id: j['id']?.toString() ?? '',
    type: (j['type'] ?? j['type_id'] ?? j['incident_type'] ?? 'unknown').toString(),
    status: j['status']?.toString() ?? 'created',
    latitude: double.tryParse(j['latitude']?.toString() ?? '0') ?? 0.0,
    longitude: double.tryParse(j['longitude']?.toString() ?? '0') ?? 0.0,
    locationName: j['location_name']?.toString(),
    citizenName: j['citizen_name']?.toString(),
    notes: j['notes']?.toString(),
    assignedVehicleId: j['assigned_vehicle_id']?.toString(),
    parentIncidentId: j['parent_incident_id']?.toString(),
    destinationHospitalId: j['destination_hospital_id']?.toString(),
    destinationHospitalName: j['destination_hospital_name']?.toString(),
    createdAt: j['created_at'] != null ? DateTime.tryParse(j['created_at'].toString()) ?? DateTime.now() : DateTime.now(),
  );

  bool get isActive => status == 'dispatched' || status == 'in_progress';
}
