import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'incident_screen.dart';
import 'profile_screen.dart';
import '../models/incident.dart';
import '../models/vehicle.dart';
import '../providers/auth_provider.dart';
import '../config/api_config.dart';
import '../services/incident_service.dart';
import '../services/vehicle_service.dart';
import '../services/ws_service.dart';
import '../widgets/status_badge.dart';

// Incident type → map marker hue (NAPSG v5.0 aligned, ux_logic.md §8)
// Medical: Red (0°), Fire: Orange (~30°), Crime/Police: Azure (~210°, closer to #1565C0 than Blue 240°)
const _incidentHue = {
  'medical': BitmapDescriptor.hueRed,
  'fire': BitmapDescriptor.hueOrange,
  'crime': BitmapDescriptor.hueAzure,
};

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _incidentSvc = IncidentService();
  final _vehicleSvc = VehicleService();

  List<Incident> _incidents = [];
  bool _loading = true;
  String? _loadError;
  String? _vehicleId;
  Vehicle? _vehicle;
  bool _gpsPermDenied = false;
      Position? _currentPosition;
  Timer? _refreshTimer;
  Timer? _gpsTimer;
  Timer? _stalenessTimer;
  Timer? _simCheckTimer;          // eagerly detects simulation before WS arrives
  StreamSubscription<Map<String, dynamic>>? _wsSub;
  bool _isUnderSimulation = false;
  GoogleMapController? _mapController;
  DateTime? _lastApiFetch;
  bool _isStale = false;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
    _startGps();
    _stalenessTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _checkStaleness(),
    );
    // Check simulation status eagerly so the map hides real GPS immediately
    _simCheckTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _checkSimulationStatus(),
    );
    _checkSimulationStatus(); // also run immediately on load
  }

  void _checkStaleness() {
    if (_lastApiFetch == null) return;
    final stale = DateTime.now().difference(_lastApiFetch!).inSeconds > 30;
    if (stale != _isStale && mounted) {
      setState(() => _isStale = stale);
    }
  }

  @override
  void dispose() {
    _stalenessTimer?.cancel();
    _refreshTimer?.cancel();
    _gpsTimer?.cancel();
    _simCheckTimer?.cancel();
    _wsSub?.cancel();
    WsService.instance.disconnect();
    _mapController?.dispose();
    super.dispose();
  }

  String get _token => context.read<AuthProvider>().user?.accessToken ?? '';

  /// Eagerly checks whether this driver's vehicle is currently under simulation.
  /// This runs before any WS events arrive so myLocationEnabled switches off immediately.
  Future<void> _checkSimulationStatus() async {
    if (_vehicleId == null) return;
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.trackingUrl}/simulations/active'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final sims = (body['simulations'] ?? body['active'] ?? []) as List<dynamic>;
        final underSim = sims.any((s) => s['vehicleId']?.toString() == _vehicleId);
        if (mounted && underSim != _isUnderSimulation) {
          setState(() => _isUnderSimulation = underSim);
        }
      }
    } catch (_) {}
  }

  Future<void> _load() async {
    try {
      final incidents = await _incidentSvc.listOpenIncidents(_token);
      if (mounted) {
        setState(() {
          _incidents = incidents;
          _loading = false;
          _loadError = null;
          _lastApiFetch = DateTime.now();
        });
      }
    } catch (e) {
      debugPrint('Load incidents error: $e');
      if (mounted) {
        setState(() {
          _loading = false;
          _loadError = 'Failed to load incidents. Tap to retry.';
        });
      }
    }
  }

  Future<void> _startGps() async {
    final token = _token;
    final userId = context.read<AuthProvider>().user?.id;

    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever ||
        perm == LocationPermission.denied) {
      if (mounted) setState(() => _gpsPermDenied = true);
      return;
    }

    try {
      final vehicles = await _vehicleSvc.listVehicles(token);
      final assigned = userId != null
          ? vehicles.where((v) => v.driverUserId == userId).toList()
          : <Vehicle>[];
      final match = assigned.isNotEmpty ? assigned.first : null;
      if (mounted) {
        setState(() {
          _vehicle = match;
          _vehicleId = match?.id;
        });
      }
    } catch (e) {
      debugPrint('Load vehicles error: $e');
    }

    // Initial position — only used if simulation is NOT active.
    // If WS starts delivering events, this value will be replaced.
    try {
      final pos = await Geolocator.getCurrentPosition();
      if (mounted && !_isUnderSimulation) {
        setState(() {
          _currentPosition = pos;
        });
      }
    } catch (_) {}

    _gpsTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      try {
        final pos = await Geolocator.getCurrentPosition();
        // Only update the displayed position from real GPS when NOT under simulation.
        // When _isUnderSimulation is true, WS events are the sole position source.
        if (mounted && !_isUnderSimulation) {
          setState(() {
            _currentPosition = pos;
          });
        }
        if (_vehicleId != null) {
          // Fire-and-forget — backend returns 409 if simulation is active.
          _vehicleSvc.updateLocation(
            _token,
            _vehicleId!,
            pos.latitude,
            pos.longitude,
          ).catchError((_) {});
        }
      } catch (e) {
        debugPrint('Update location error: $e');
      }
    });

    // Subscribe to real-time simulation position broadcasts.
    // When the backend simulation engine moves the vehicle, it broadcasts
    // `vehicle.location.updated` via WebSocket. We use that to keep the
    // driver's map marker and position in sync regardless of their GPS.
    if (_vehicleId != null) {
      final wsStream = WsService.instance.connect(_token);
      _wsSub = wsStream.listen((msg) {
        if (msg['type'] != 'vehicle.location.updated') return;
        final payload = msg['payload'] as Map<String, dynamic>?;
        if (payload == null) return;
        final vid = payload['vehicle_id']?.toString();
        if (vid != _vehicleId) return; // ignore other vehicles

        final lat = double.tryParse(payload['latitude']?.toString() ?? '');
        final lng = double.tryParse(payload['longitude']?.toString() ?? '');
        if (lat == null || lng == null) return;

        // First event tells us simulation is active — lock out Geolocator
        _isUnderSimulation = true;

        if (mounted) {
          setState(() {
            _currentPosition = Position(
              latitude: lat,
              longitude: lng,
              timestamp: DateTime.now(),
              accuracy: 0,
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              headingAccuracy: 0,
              speed: 0,
              speedAccuracy: 0,
            );
          });
          _mapController?.animateCamera(
            CameraUpdate.newLatLng(LatLng(lat, lng)),
          );
        }
      });
    }
  }

  

  // Top-level (non-child) incidents only, for map and queue display
  List<Incident> get _topLevelIncidents =>
      _incidents.where((i) => i.parentIncidentId == null).toList();

  // Active incident assigned to this user's vehicle
  Incident? get _myActiveIncident {
    if (_vehicleId != null) {
      try {
        return _incidents.firstWhere(
          (i) => i.isActive && i.assignedVehicleId == _vehicleId,
        );
      } catch (_) {}
    }
    return null;
  }

  Set<Marker> get _mapMarkers {
    final markers = <Marker>{};
    final childCounts = <String, int>{};
    for (final i in _incidents) {
      if (i.parentIncidentId != null) {
        childCounts[i.parentIncidentId!] =
            (childCounts[i.parentIncidentId!] ?? 0) + 1;
      }
    }

    for (final inc in _topLevelIncidents) {
      final hue = _incidentHue[inc.type] ?? BitmapDescriptor.hueRed;
      final count = childCounts[inc.id] ?? 0;
      markers.add(
        Marker(
          markerId: MarkerId(inc.id),
          position: LatLng(inc.latitude, inc.longitude),
          icon: BitmapDescriptor.defaultMarkerWithHue(hue),
          infoWindow: InfoWindow(
            title: inc.locationName ?? inc.type.toUpperCase(),
            snippet: count > 0
                ? '${inc.status} · ×${count + 1} units'
                : inc.status,
          ),
          onTap: () => _mapController?.showMarkerInfoWindow(MarkerId(inc.id)),
        ),
      );
    }

    // When simulation is active, show a custom vehicle marker at the
    // simulation position instead of the native OS blue dot.
    if (_isUnderSimulation && _currentPosition != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('_sim_vehicle'),
          position: LatLng(
            _currentPosition!.latitude,
            _currentPosition!.longitude,
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueOrange,
          ),
          infoWindow: InfoWindow(
            title: _vehicle?.displayName ?? 'Your vehicle',
            snippet: _vehicle != null
                ? '${_vehicle!.type.toUpperCase()} · simulation'
                : 'simulation',
          ),
          zIndex: 10,
        ),
      );
    }

    return markers;
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final activeInc = _myActiveIncident;
    final queuedIncidents = _topLevelIncidents
        .where((i) => i.status == 'created')
        .toList();

    final LatLng cameraTarget = activeInc != null
        ? LatLng(activeInc.latitude, activeInc.longitude)
        : _currentPosition != null
        ? LatLng(_currentPosition!.latitude, _currentPosition!.longitude)
        : const LatLng(5.6037, -0.1870); // Accra fallback
    final double cameraZoom = activeInc != null ? 15 : 14;

    return Scaffold(
      body: Stack(
        children: [
          // Background MAP
          Positioned.fill(
            child: GoogleMap(
              initialCameraPosition: CameraPosition(
                target: cameraTarget,
                zoom: cameraZoom,
              ),
              // Disable native OS blue dot during simulation — we show our
              // own orange marker from WS position updates instead.
              myLocationEnabled: !_isUnderSimulation,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              compassEnabled: false,
              markers: _mapMarkers,
              onMapCreated: (ctrl) {
                _mapController = ctrl;
                if (activeInc != null) {
                  ctrl.animateCamera(
                    CameraUpdate.newLatLngZoom(
                      LatLng(activeInc.latitude, activeInc.longitude),
                      15,
                    ),
                  );
                }
              },
            ),
          ),

          // Top Bar (matching web UI topBar)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 16,
                left: 16,
                right: 16,
                bottom: 16,
              ),
              decoration: const BoxDecoration(
                color: Color.fromRGBO(255, 255, 255, 0.9), // Transparent white
                border: Border(bottom: BorderSide(color: Colors.black12)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'NERDCO Field',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        user?.name ?? 'Responder',
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.black54,
                        ),
                      ),
                      // Vehicle identification badge
                      if (_vehicle != null) ...
                        [
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: _isUnderSimulation
                                  ? const Color(0xFFFF6D00)
                                  : const Color(0xFF005953),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  _vehicle!.type == 'ambulance'
                                      ? Icons.local_hospital
                                      : _vehicle!.type == 'fire_truck'
                                          ? Icons.local_fire_department
                                          : Icons.local_police,
                                  color: Colors.white,
                                  size: 12,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  _vehicle!.displayName,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                if (_isUnderSimulation) ...[
                                  const SizedBox(width: 4),
                                  const Text(
                                    '· SIM',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.person_outline),
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ProfileScreen(),
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.logout),
                        onPressed: () {
                          context.read<AuthProvider>().logout();
                          // No need to push route; _AppRoot handles auth state switch.
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Indicators
          if (_loading && _incidents.isEmpty)
            const Align(
              alignment: Alignment.center,
              child: CircularProgressIndicator(),
            ),

          if (_loadError != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 80,
              left: 16,
              right: 16,
              child: Card(
                color: Colors.red.shade100,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    'Error: ',
                    style: TextStyle(color: Colors.red.shade900),
                  ),
                ),
              ),
            ),

          // Bottom Sheet
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 500),
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 10,
                    spreadRadius: 5,
                  ),
                ],
              ),
              padding: const EdgeInsets.all(16),
              child: activeInc != null
                  ? _buildActiveAssignment(activeInc)
                  : _buildQueuedIncidents(queuedIncidents),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveAssignment(Incident activeInc) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Colors.redAccent,
                size: 20,
              ),
              const SizedBox(width: 8),
              const Text(
                'Active Assignment',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            activeInc.type.toUpperCase(),
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: Colors.white,
            ),
          ),
          Text(
            activeInc.locationName ?? 'Unknown Location',
            style: const TextStyle(fontSize: 13, color: Colors.white70),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) =>
                      IncidentScreen(incidentId: activeInc.id),
                ),
              );
            },
            child: const Text(
              'View Details',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQueuedIncidents(List<Incident> queuedIncidents) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Incoming Feed ()',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
        const SizedBox(height: 8),
        if (queuedIncidents.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                'You have no assignments. Stand by.',
                style: TextStyle(color: Colors.black54, fontSize: 13),
              ),
            ),
          )
        else
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.4,
            ),
            child: ListView.separated(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              separatorBuilder: (context, index) => const SizedBox(height: 8),
              itemCount: queuedIncidents.length,
              itemBuilder: (context, index) {
                final inc = queuedIncidents[index];
                return GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) =>
                            IncidentScreen(incidentId: inc.id),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black12,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                inc.type,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            StatusBadge(status: inc.status),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          inc.locationName ?? 'Unknown Location',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          'Reported ',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
