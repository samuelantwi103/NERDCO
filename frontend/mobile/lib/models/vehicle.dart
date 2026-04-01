enum VehicleStatus { available, dispatched, unavailable }

VehicleStatus parseVehicleStatus(String raw) {
  switch (raw) {
    case 'available':   return VehicleStatus.available;
    case 'dispatched':  return VehicleStatus.dispatched;
    case 'unavailable': return VehicleStatus.unavailable;
    default:            return VehicleStatus.unavailable;
  }
}

class Vehicle {
  final String id;
  final String plateNumber;
  final String? callSign;
  final String type;
  final VehicleStatus status;
  final double? currentLatitude;
  final double? currentLongitude;
  final String? orgId;
  final String? orgName;
  final String? driverUserId;

  const Vehicle({
    required this.id,
    required this.plateNumber,
    this.callSign,
    required this.type,
    required this.status,
    this.currentLatitude,
    this.currentLongitude,
    this.orgId,
    this.orgName,
    this.driverUserId,
  });

    factory Vehicle.fromJson(Map<String, dynamic> j) => Vehicle(
    id:               j['id']?.toString() ?? '',
    plateNumber:      j['plate_number']?.toString() ?? 'Unknown',
    callSign:         j['call_sign']?.toString(),
    type:             j['type']?.toString() ?? 'unknown',
    status:           parseVehicleStatus(j['status']?.toString() ?? 'active'),
    currentLatitude:  j['current_latitude']  != null ? double.tryParse(j['current_latitude'].toString()) : null,
    currentLongitude: j['current_longitude'] != null ? double.tryParse(j['current_longitude'].toString()) : null,
    orgId:            j['organization_id']?.toString(),
    orgName:          j['org_name']?.toString(),
    driverUserId:     j['driver_user_id']?.toString(),
  );

  String get displayName => callSign ?? plateNumber;
}
