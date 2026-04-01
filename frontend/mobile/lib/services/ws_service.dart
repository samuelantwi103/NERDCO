import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/api_config.dart';

/// Connects to tracking-service WebSocket and streams location broadcast messages.
class WsService {
  // ─── singleton ────────────────────────────────────────────────────────────
  static final WsService _instance = WsService._internal();
  factory WsService() => _instance;
  WsService._internal();
  static WsService get instance => _instance;
  // ──────────────────────────────────────────────────────────────────────────

  WebSocketChannel? _channel;

  Stream<Map<String, dynamic>>? _stream;

  Stream<Map<String, dynamic>> connect(String token) {
    _channel?.sink.close();
    _channel = WebSocketChannel.connect(Uri.parse(ApiConfig.vehicleWsUrl));

    // Authenticate immediately after connecting
    _channel!.sink.add(jsonEncode({'type': 'auth', 'token': token}));

    _stream = _channel!.stream.map((raw) {
      try {
        return jsonDecode(raw as String) as Map<String, dynamic>;
      } catch (_) {
        return <String, dynamic>{};
      }
    });

    return _stream!;
  }

  void close() => disconnect();

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
    _stream  = null;
  }
}
