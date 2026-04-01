import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class OfflineQueueService {
  static const String queueKey = 'offline_requests_queue';

  Future<void> enqueueRequest(
    String method,
    String url,
    Map<String, String> headers,
    dynamic body,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final queueStr = prefs.getStringList(queueKey) ?? [];

    final request = {
      'method': method,
      'url': url,
      'headers': headers,
      'body': body,
    };

    queueStr.add(jsonEncode(request));
    await prefs.setStringList(queueKey, queueStr);
  }

  Future<void> syncQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final queueStr = prefs.getStringList(queueKey) ?? [];
    if (queueStr.isEmpty) return;

    List<String> remainingQueue = [];

    for (String reqStr in queueStr) {
      final req = jsonDecode(reqStr);
      try {
        final uri = Uri.parse(req['url']);
        http.Response response;

        switch (req['method']) {
          case 'POST':
            response = await http.post(
              uri,
              headers: Map<String, String>.from(req['headers']),
              body: jsonEncode(req['body']),
            );
            break;
          case 'PUT':
            response = await http.put(
              uri,
              headers: Map<String, String>.from(req['headers']),
              body: jsonEncode(req['body']),
            );
            break;
          case 'DELETE':
            response = await http.delete(
              uri,
              headers: Map<String, String>.from(req['headers']),
            );
            break;
          default:
            response = await http.get(
              uri,
              headers: Map<String, String>.from(req['headers']),
            );
            break;
        }

        if (response.statusCode >= 500) {
          // Keep in queue if server error
          remainingQueue.add(reqStr);
        }
      } catch (e) {
        // Network error, keep in queue
        remainingQueue.add(reqStr);
      }
    }

    await prefs.setStringList(queueKey, remainingQueue);
  }
}
