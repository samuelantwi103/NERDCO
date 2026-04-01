import 'dart:convert';
import '../utils/http_client.dart' as http;
import '../config/api_config.dart';
import '../models/vehicle.dart';

class VehicleService {
  Map<String, String> _headers(String token) => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  Future<List<Vehicle>> listVehicles(String token) async {
    final res = await http.get(
      Uri.parse('${ApiConfig.trackingUrl}/vehicles'),
      headers: _headers(token),
    );
    if (res.statusCode != 200) throw Exception('Failed to fetch vehicles');
    final data = jsonDecode(res.body);
    final list = (data['vehicles'] ?? data) as List<dynamic>;
    return list.map((j) => Vehicle.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<void> updateLocation(String token, String vehicleId, double lat, double lng) async {
    await http.put(
      Uri.parse('${ApiConfig.trackingUrl}/vehicles/$vehicleId/location'),
      headers: _headers(token),
      body: jsonEncode({'latitude': lat, 'longitude': lng}),
    );
  }

  Future<void> updateStatus(String token, String vehicleId, String status) async {
    await http.put(
      Uri.parse('${ApiConfig.trackingUrl}/vehicles/$vehicleId/status'),
      headers: _headers(token),
      body: jsonEncode({'status': status}),
    );
  }
}
