import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/ws_service.dart';

class AuthProvider extends ChangeNotifier {
  AppUser? _user;
  AppUser? get user => _user;
  bool get isAuthenticated => _user != null;

  WsService? _wsService;
  /// Exposes the raw WebSocket event stream for consumers (e.g. VehicleProvider).
  Stream<Map<String, dynamic>>? get wsStream => _wsStream;
  Stream<Map<String, dynamic>>? _wsStream;

  Timer? _refreshTimer;

  final _storage  = const FlutterSecureStorage();
  final _authSvc  = AuthService();

  static const _kAccessToken  = 'nerdco_access_token';
  static const _kRefreshToken = 'nerdco_refresh_token';

  /// Try to restore session from secure storage on app start.
  Future<void> tryRestoreSession() async {
    final accessToken  = await _storage.read(key: _kAccessToken);
    final refreshToken = await _storage.read(key: _kRefreshToken);
    if (accessToken == null || refreshToken == null) return;

    // Check expiry via JWT payload (no library needed — base64 decode)
    try {
      final payload = _decodeJwtPayload(accessToken);
      final exp = payload['exp'] as int?;
      final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;

      if (exp != null && exp > now) {
        _setUserFromToken(accessToken, refreshToken, payload);
        _connectWs(accessToken);
        return;
      }
    } catch (_) {}

    // Access token expired — try refresh
    try {
      final data = await _authSvc.refreshToken(refreshToken);
      final newAccess  = data['access_token'] as String;
      final newRefresh = data['refresh_token'] as String? ?? refreshToken;
      await _persist(newAccess, newRefresh);
      final payload = _decodeJwtPayload(newAccess);
      _setUserFromToken(newAccess, newRefresh, payload);
      _connectWs(newAccess);
    } catch (_) {
      await _clearStorage();
    }
  }

  Future<void> login(String email, String password) async {
    final data       = await _authSvc.login(email, password);
    final accessToken  = data['access_token'] as String;
    final refreshToken = data['refresh_token'] as String;
    final payload    = _decodeJwtPayload(accessToken);

    await _persist(accessToken, refreshToken);
    _setUserFromToken(accessToken, refreshToken, payload, userData: data['user'] as Map<String, dynamic>?);
    _connectWs(accessToken);
  }

  Future<void> logout() async {
    _refreshTimer?.cancel();
    _refreshTimer = null;
    if (_user != null) {
      await _authSvc.logout(_user!.accessToken, _user!.refreshToken).catchError((_) {});
    }
    _wsService?.close();
    _wsService = null;
    _wsStream  = null;
    await _clearStorage();
    _user = null;
    notifyListeners();
  }

  Future<String?> refreshAccessToken() async {
    if (_user == null) return null;
    _refreshTimer?.cancel();
    _refreshTimer = null;
    try {
      final data       = await _authSvc.refreshToken(_user!.refreshToken);
      final newAccess  = data['access_token'] as String;
      final newRefresh = data['refresh_token'] as String? ?? _user!.refreshToken;
      await _persist(newAccess, newRefresh);
      final payload = _decodeJwtPayload(newAccess);
      _setUserFromToken(newAccess, newRefresh, payload);
      return newAccess;
    } catch (_) {
      await logout();
      return null;
    }
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  void _connectWs(String token) {
    _wsService?.close();
    _wsService = WsService();
    _wsStream  = _wsService!.connect(token);
  }

  Map<String, dynamic> _decodeJwtPayload(String token) {
    final parts = token.split('.');
    if (parts.length < 2) throw FormatException('Invalid JWT');
    var payload = parts[1];
    // Base64 padding
    while (payload.length % 4 != 0) { payload += '='; }
    final decoded = utf8.decode(base64Url.decode(payload));
    return jsonDecode(decoded) as Map<String, dynamic>;
  }

  /// Update only the display name of the current user (after a profile save).
  void updateName(String name) {
    if (_user == null) return;
    _user = AppUser(
      id:           _user!.id,
      name:         name,
      email:        _user!.email,
      role:         _user!.role,
      org:          _user!.org,
      accessToken:  _user!.accessToken,
      refreshToken: _user!.refreshToken,
    );
    notifyListeners();
  }

  void _setUserFromToken(String access, String refresh, Map<String, dynamic> payload, {Map<String, dynamic>? userData}) {
    _user = AppUser(
      id:           (userData?['id']    ?? payload['sub']   ?? '') as String,
      name:         (userData?['name']  ?? payload['name']  ?? '') as String,
      email:        (userData?['email'] ?? payload['email'] ?? '') as String,
      role:         parseRole((userData?['role'] ?? payload['role'] ?? 'first_responder') as String),
      org:          payload['org'] as String?,
      accessToken:  access,
      refreshToken: refresh,
    );
    _scheduleTokenRefresh(payload);
    notifyListeners();
  }

  /// Schedule a proactive token refresh 60 s before the access token expires.
  void _scheduleTokenRefresh(Map<String, dynamic> payload) {
    _refreshTimer?.cancel();
    _refreshTimer = null;
    final exp = payload['exp'] as int?;
    if (exp == null) return;
    final now     = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final delay   = exp - now - 60;
    if (delay <= 0) {
      // Already near expiry — refresh immediately.
      refreshAccessToken();
      return;
    }
    _refreshTimer = Timer(Duration(seconds: delay), () => refreshAccessToken());
  }

  Future<void> _persist(String access, String refresh) async {
    await Future.wait([
      _storage.write(key: _kAccessToken,  value: access),
      _storage.write(key: _kRefreshToken, value: refresh),
    ]);
  }

  Future<void> _clearStorage() async {
    await Future.wait([
      _storage.delete(key: _kAccessToken),
      _storage.delete(key: _kRefreshToken),
    ]);
  }
}
