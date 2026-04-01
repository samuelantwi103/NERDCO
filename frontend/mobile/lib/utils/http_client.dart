import 'package:http/http.dart' as http;
// import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/network_provider.dart';
import '../services/offline_queue_service.dart';
import '../main.dart';
import 'dart:convert';

final _offlineQueue = OfflineQueueService();

typedef Response = http.Response;
typedef StreamedResponse = http.StreamedResponse;
typedef MultipartRequest = http.MultipartRequest;
typedef ByteStream = http.ByteStream;

Future<Response> get(Uri url, {Map<String, String>? headers}) async {
  final res = await http.get(url, headers: headers).timeout(const Duration(seconds: 10));
  _checkAuth(res);
  return res;
}

Future<Response> post(
  Uri url, {
  Map<String, String>? headers,
  Object? body,
  Encoding? encoding,
}) async {
  if (_isOffline()) {
    await _offlineQueue.enqueueRequest(
      'POST',
      url.toString(),
      headers ?? {},
      body,
    );
    return http.Response('{"queued":true}', 202);
  }
  final res = await http.post(
    url,
    headers: headers,
    body: body,
    encoding: encoding,
  );
  _checkAuth(res);
  return res;
}

Future<Response> put(
  Uri url, {
  Map<String, String>? headers,
  Object? body,
  Encoding? encoding,
}) async {
  if (_isOffline()) {
    await _offlineQueue.enqueueRequest(
      'PUT',
      url.toString(),
      headers ?? {},
      body,
    );
    return http.Response('{"queued":true}', 202);
  }
  final res = await http.put(
    url,
    headers: headers,
    body: body,
    encoding: encoding,
  );
  _checkAuth(res);
  return res;
}

Future<Response> patch(
  Uri url, {
  Map<String, String>? headers,
  Object? body,
  Encoding? encoding,
}) async {
  if (_isOffline()) {
    await _offlineQueue.enqueueRequest(
      'PATCH',
      url.toString(),
      headers ?? {},
      body,
    );
    return http.Response('{"queued":true}', 202);
  }
  final res = await http.patch(
    url,
    headers: headers,
    body: body,
    encoding: encoding,
  );
  _checkAuth(res);
  return res;
}

Future<Response> delete(
  Uri url, {
  Map<String, String>? headers,
  Object? body,
  Encoding? encoding,
}) async {
  if (_isOffline()) {
    await _offlineQueue.enqueueRequest(
      'DELETE',
      url.toString(),
      headers ?? {},
      body,
    );
    return http.Response('{"queued":true}', 202);
  }
  final res = await http.delete(
    url,
    headers: headers,
    body: body,
    encoding: encoding,
  );
  _checkAuth(res);
  return res;
}

bool _isOffline() {
  final ctx = navigatorKey.currentContext;
  if (ctx == null) return false;
  return !ctx.read<NetworkProvider>().isOnline;
}

void _checkAuth(Response res) {
  if (res.statusCode == 401) {
    if (navigatorKey.currentContext != null) {
      navigatorKey.currentContext!.read<AuthProvider>().logout();
    }
  }
}
