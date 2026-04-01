import 'dart:convert';
import '../utils/http_client.dart' as http;
import '../config/api_config.dart';
class AuthService {
  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.authUrl}/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['message'] ?? 'Login failed');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> refreshToken(String refreshToken) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.authUrl}/auth/refresh-token'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refresh_token': refreshToken}),
    );
    if (res.statusCode != 200) throw Exception('Token refresh failed');
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<void> logout(String accessToken, String refreshToken) async {
    await http.post(
      Uri.parse('${ApiConfig.authUrl}/auth/logout'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: jsonEncode({'refresh_token': refreshToken}),
    );
  }

  /// Update the current user's display name via the /auth/profile endpoint.
  Future<void> updateName(String accessToken, String name) async {
    final res = await http.patch(
      Uri.parse('${ApiConfig.authUrl}/auth/profile'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: jsonEncode({'name': name}),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['message'] ?? 'Update failed');
    }
  }

  /// Change the current user's password via the /auth/profile endpoint.
  Future<void> changePassword(String accessToken, String newPassword) async {
    final res = await http.patch(
      Uri.parse('${ApiConfig.authUrl}/auth/profile'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: jsonEncode({'password': newPassword}),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['message'] ?? 'Password change failed');
    }
  }

  /// Fetch the current user's profile from the backend.
  Future<Map<String, dynamic>> getProfile(String accessToken) async {
    final res = await http.get(
      Uri.parse('${ApiConfig.authUrl}/auth/profile'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode != 200) throw Exception('Failed to load profile');
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
