import 'dart:convert';
import '../utils/http_client.dart' as http;
import '../config/api_config.dart';
import '../models/incident.dart';

class IncidentService {
  Map<String, String> _headers(String token) => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  Future<List<Incident>> listOpenIncidents(String token) async {
    final res = await http.get(
      Uri.parse('${ApiConfig.incidentUrl}/incidents/open'),
      headers: _headers(token),
    );
    if (res.statusCode != 200) throw Exception('Failed to fetch incidents');
    final data = jsonDecode(res.body);
    final list = (data['incidents'] ?? data) as List<dynamic>;
    return list.map((j) => Incident.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<Incident> getIncident(String token, String id) async {
    final res = await http.get(
      Uri.parse('${ApiConfig.incidentUrl}/incidents/$id'),
      headers: _headers(token),
    );
    if (res.statusCode != 200) throw Exception('Failed to fetch incident');
    final data = jsonDecode(res.body);
    return Incident.fromJson((data['incident'] ?? data) as Map<String, dynamic>);
  }

  Future<Incident> updateStatus(String token, String id, String status) async {
    final res = await http.put(
      Uri.parse('${ApiConfig.incidentUrl}/incidents/$id/status'),
      headers: _headers(token),
      body: jsonEncode({'status': status}),
    );
    if (res.statusCode != 200) throw Exception('Status update failed');
    final data = jsonDecode(res.body);
    return Incident.fromJson((data['incident'] ?? data) as Map<String, dynamic>);
  }

  Future<void> requestSupport(String token, String id, String supportType) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.incidentUrl}/incidents/$id/request-support'),
      headers: _headers(token),
      body: jsonEncode({'support_type': supportType}),
    );
    if (res.statusCode != 200 && res.statusCode != 201) {
      String msg = 'Support request failed';
      try {
        final data = jsonDecode(res.body);
        if (data['message'] != null) msg = data['message'] as String;
      } catch (_) {}
      throw Exception(msg);
    }
  }

  Future<List<Incident>> getRelated(String token, String id) async {
    final res = await http.get(
      Uri.parse('${ApiConfig.incidentUrl}/incidents/$id/related'),
      headers: _headers(token),
    );
    if (res.statusCode != 200) return [];
    final data = jsonDecode(res.body);
    final list = (data['incidents'] ?? []) as List<dynamic>;
    return list.map((j) => Incident.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<List<Incident>> getNearbyIncidents(String token, {required double lat, required double lng, String? excludeId}) async {
    final Map<String, dynamic> queryParams = {
      'lat': lat.toString(),
      'lng': lng.toString(),
      'radius': '1',
    };
    if (excludeId != null) {
      queryParams['exclude'] = excludeId;
    }
    final uri = Uri.parse('${ApiConfig.incidentUrl}/incidents/nearby').replace(queryParameters: queryParams);
    
    final res = await http.get(uri, headers: _headers(token));
    if (res.statusCode != 200) return [];
    final data = jsonDecode(res.body);
    final list = (data['incidents'] ?? []) as List<dynamic>;
    return list.map((j) => Incident.fromJson(j as Map<String, dynamic>)).toList();
  }
}
