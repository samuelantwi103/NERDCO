import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../services/offline_queue_service.dart';

class NetworkProvider extends ChangeNotifier {
  bool _isOnline = true;
  bool get isOnline => _isOnline;

  final _offlineQueue = OfflineQueueService();

  NetworkProvider() {
    Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> result) {
      bool online = result.isNotEmpty && result.first != ConnectivityResult.none;
      if (online != _isOnline) {
        final wasOffline = !_isOnline;
        _isOnline = online;
        notifyListeners();
        if (online && wasOffline) {
          _offlineQueue.syncQueue();
        }
      }
    });
    
    _checkInitial();
  }

  Future<void> _checkInitial() async {
    final result = await Connectivity().checkConnectivity();
    _isOnline = result.isNotEmpty && result.first != ConnectivityResult.none;
    notifyListeners();
  }
}
