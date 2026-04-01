import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../config/design_tokens.dart';
import '../models/incident.dart';
import '../models/vehicle.dart';
import '../providers/auth_provider.dart';
import '../services/incident_service.dart';
import '../services/vehicle_service.dart';
import '../widgets/status_badge.dart';
import '../utils/marker_generator.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class IncidentScreen extends StatefulWidget {
  final String incidentId;
  const IncidentScreen({super.key, required this.incidentId});

  @override
  State<IncidentScreen> createState() => _IncidentScreenState();
}

class _IncidentScreenState extends State<IncidentScreen> {
  final _svc = IncidentService();
  final _vehicleSvc = VehicleService();

  Incident? _incident;
  List<Incident> _related = [];
  List<Incident> _nearby = [];
  List<Vehicle> _vehicles = [];
  bool _loading = true;
  bool _acting = false;
  String? _error;
  Timer? _timer;
  Timer? _gpsTimer;
  Timer? _stalenessTimer;

  Position? _currentPosition;
  StreamSubscription<Position>? _positionSub;
  bool _routeFetched = false;
  String? _distanceStr;
  String? _durationStr;

  Timer? _simCheckTimer;
  bool _isUnderSimulation = false;
  Vehicle? _vehicle;
  String? _vehicleId;

  GoogleMapController? _mapController;
  Set<Polyline> _polylines = {};

  final Map<String, BitmapDescriptor> _customMarkers = {};
  DateTime? _lastApiFetch;
  bool _isStale = false;

  @override
  void initState() {
    super.initState();
    _initCustomMarkers();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
    _stalenessTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _checkStaleness(),
    );
    _simCheckTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _checkSimulationStatus(),
    );
    _checkSimulationStatus();
    _startGps();
  }

  void _checkStaleness() {
    if (_lastApiFetch == null) return;
    final stale = DateTime.now().difference(_lastApiFetch!).inSeconds > 30;
    if (stale != _isStale && mounted) {
      setState(() => _isStale = stale);
    }
  }

  Future<void> _checkSimulationStatus() async {
    if (_vehicleId == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://nerdco-tracking.onrender.com/simulations/active?_t=\${DateTime.now().millisecondsSinceEpoch}'),
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

  Future<void> _initCustomMarkers() async {
    final Map<String, BitmapDescriptor> markers = {};
    markers['medical'] = await createNapsgMarkerBitmap(
      'medical',
      NerdcoColors.medical,
      size: 60,
    );
    markers['fire'] = await createNapsgMarkerBitmap(
      'fire',
      NerdcoColors.fire,
      size: 60,
    );
    markers['crime'] = await createNapsgMarkerBitmap(
      'crime',
      NerdcoColors.police,
      size: 60,
    );
    if (mounted) {
      setState(() => _customMarkers.addAll(markers));
    }
  }

  @override
  void dispose() {
    _stalenessTimer?.cancel();
    _timer?.cancel();
    _simCheckTimer?.cancel();
    _positionSub?.cancel();
    _gpsTimer?.cancel();
    _mapController?.dispose();
    super.dispose();
  }

  String get _token => context.read<AuthProvider>().user?.accessToken ?? '';

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }

  Future<void> _load() async {
    try {
      final inc = await _svc.getIncident(_token, widget.incidentId);
      final rel = await _svc.getRelated(_token, widget.incidentId);
      final nearby = await _svc.getNearbyIncidents(
        _token,
        lat: inc.latitude,
        lng: inc.longitude,
        excludeId: inc.id,
      );
      final vehicles = await _vehicleSvc.listVehicles(_token);
      if (mounted) {
        setState(() {
          _incident = inc;
          _related = rel;
          _nearby = nearby;
          _vehicles = vehicles;
          
          final me = context.read<AuthProvider>().user?.id;
          if (me != null) {
            final myVeh = vehicles.where((v) => v.driverUserId == me).firstOrNull;
            _vehicle = myVeh;
            _vehicleId = myVeh?.id;
          }

          _loading = false;
          _error = null;
          _lastApiFetch = DateTime.now();
        });
        _checkSimulationStatus();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _startGps() async {
    LocationPermission perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied ||
        perm == LocationPermission.deniedForever) {
      return;
    }

    try {
      final pos = await Geolocator.getCurrentPosition();
      if (mounted) setState(() => _currentPosition = pos);
    } catch (_) {}

    _positionSub =
        Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 10,
          ),
        ).listen((pos) {
          if (mounted) setState(() => _currentPosition = pos);
        });
  }

  Future<void> _confirmUpdateStatus(
    String status,
    String title,
    String content,
  ) async {
    final theme = Theme.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Cancel',
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _updateStatus(status);
    }
  }

  Future<void> _updateStatus(String status) async {
    setState(() {
      _acting = true;
      _error = null;
    });
    try {
      final updated = await _svc.updateStatus(
        _token,
        widget.incidentId,
        status,
      );
      setState(() {
        _incident = updated;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      setState(() {
        _acting = false;
      });
    }
  }

  Future<void> _requestSupport() async {
    final chosen = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => const _SupportTypeSheet(),
    );
    if (chosen == null) return;

    setState(() {
      _acting = true;
      _error = null;
    });
    try {
      await _svc.requestSupport(_token, widget.incidentId, chosen);
      final rel = await _svc.getRelated(_token, widget.incidentId);
      setState(() {
        _related = rel;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      setState(() {
        _acting = false;
      });
    }
  }

  Future<void> _resumeSimulation() async {
    if (_vehicleId == null) return;
    setState(() {
      _acting = true;
      _error = null;
    });
    try {
      final res = await http.post(
        Uri.parse('https://nerdco-tracking.onrender.com/simulations/$_vehicleId/resume'),
        headers: {
          'Authorization': 'Bearer $_token',
        },
      );
      if (res.statusCode != 200) {
        throw Exception('Failed to resume simulation');
      }
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Route to hospital initiated!')));
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      setState(() {
        _acting = false;
      });
    }
  }

  Set<Marker> get _mapMarkers {
    final markers = <Marker>{};
    final inc = _incident;
    if (inc != null) {
      final icon = _customMarkers[inc.type] ?? BitmapDescriptor.defaultMarker;
      markers.add(
        Marker(
          markerId: MarkerId(inc.id),
          position: LatLng(inc.latitude, inc.longitude),
          icon: icon,
          infoWindow: InfoWindow(
            title: inc.locationName ?? 'Incident',
            snippet: inc.type.toUpperCase(),
          ),
        ),
      );
    }

    for (final n in _nearby) {
      markers.add(
        Marker(
          markerId: MarkerId('nearby_${n.id}'),
          position: LatLng(n.latitude, n.longitude),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueYellow,
          ),
          alpha: 0.8,
          infoWindow: InfoWindow(
            title: '${n.type.toUpperCase()} (Nearby)',
            snippet: n.assignedVehicleId != null
                ? 'Unit: ${n.assignedVehicleId}'
                : 'Unassigned',
          ),
        ),
      );
    }

    for (final rel in _related) {
      if (rel.assignedVehicleId == null) continue;
      final v = _vehicles
          .where((veh) => veh.id == rel.assignedVehicleId)
          .firstOrNull;
      if (v == null ||
          v.currentLatitude == null ||
          v.currentLongitude == null) {
        continue;
      }
      markers.add(
        Marker(
          markerId: MarkerId('backup_${rel.id}'),
          position: LatLng(v.currentLatitude!, v.currentLongitude!),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueCyan),
          infoWindow: InfoWindow(
            title: v.plateNumber,
            snippet: '${v.type} · ${rel.status}',
          ),
        ),
      );
    }

    if (_isUnderSimulation && _vehicle != null) {
      if (_vehicle!.currentLatitude != null && _vehicle!.currentLongitude != null) {
        markers.add(
          Marker(
            markerId: const MarkerId('my_sim_vehicle'),
            position: LatLng(_vehicle!.currentLatitude!, _vehicle!.currentLongitude!),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
            infoWindow: const InfoWindow(title: 'My Unit (Simulaton)', snippet: 'YOU'),
            zIndex: 100,
          ),
        );
      }
    }

    return markers;
  }

  void _drawStraightRoute() async {
    final inc = _incident;
    if (inc == null || _routeFetched) return;
    
    double? originLat;
    double? originLng;

    if (_isUnderSimulation && _vehicle != null && _vehicle!.currentLatitude != null) {
      originLat = _vehicle!.currentLatitude;
      originLng = _vehicle!.currentLongitude;
    } else if (_currentPosition != null) {
      originLat = _currentPosition!.latitude;
      originLng = _currentPosition!.longitude;
    }

    if (originLat == null || originLng == null) return;

    const String apiKey = String.fromEnvironment('MAPS_API_KEY', defaultValue: '');
    final url =
        "https://maps.googleapis.com/maps/api/directions/json?origin=$originLat,$originLng&destination=${inc.latitude},${inc.longitude}&key=$apiKey";

    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['routes'] != null && data['routes'].isNotEmpty) {
          final route = data['routes'][0];
          final leg = route['legs'][0];

          final polylineString = route['overview_polyline']['points'];
          final points = _decodePolyline(polylineString);

          if (mounted) {
            setState(() {
              _distanceStr = leg['distance']['text'];
              _durationStr = leg['duration']['text'];
              _polylines = {
                Polyline(
                  polylineId: const PolylineId('route'),
                  points: points,
                  color: const Color(0xFF0D4722),
                  width: 6,
                ),
              };
              _routeFetched = true;
            });
          }
        }
      }
    } catch (_) {}
  }

  List<LatLng> _decodePolyline(String encoded) {
    List<LatLng> poly = [];
    int index = 0, len = encoded.length;
    int lat = 0, lng = 0;

    while (index < len) {
      int b, shift = 0, result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.add(LatLng((lat / 1E5).toDouble(), (lng / 1E5).toDouble()));
    }
    return poly;
  }

  // Removed unused bottom sheet open bool

  void _recenterMap() {
    if (_mapController != null && _currentPosition != null) {
      _mapController!.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(
            target: LatLng(
              _currentPosition!.latitude,
              _currentPosition!.longitude,
            ),
            zoom: 18,
          ),
        ),
      );
    }
  }

  Color _getIncidentColor(String type) {
    switch (type.toLowerCase()) {
      case 'medical':
        return NerdcoColors.medical;
      case 'fire':
        return NerdcoColors.fire;
      case 'crime':
      case 'police':
        return NerdcoColors.police;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final inc = _incident;
    if (inc == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Incident')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: Colors.grey,
                ),
                const SizedBox(height: 16),
                Text(
                  _error ?? 'Incident not found',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (!_routeFetched &&
        _currentPosition != null &&
        (inc.status == 'dispatched' || inc.status == 'in_progress')) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _drawStraightRoute());
    }

    final isResolved = inc.status == 'resolved' || inc.status == 'cancelled';
    // unused token
    final incColor = _getIncidentColor(inc.type);

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          Positioned.fill(
            child: GoogleMap(
              initialCameraPosition: CameraPosition(
                target: LatLng(inc.latitude, inc.longitude),
                zoom: 15,
              ),
              markers: _mapMarkers,
              polylines: _polylines,
              myLocationEnabled: !_isUnderSimulation,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              compassEnabled: false,
              scrollGesturesEnabled: true,
              zoomGesturesEnabled: true,
              onMapCreated: (ctrl) => _mapController = ctrl,
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 12,
                left: 12,
                right: 12,
                bottom: 12,
              ),
              decoration: const BoxDecoration(
                color: Color.fromRGBO(255, 255, 255, 0.9), // Transparent white
                border: Border(bottom: BorderSide(color: Colors.black12)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      inc.locationName ?? 'Incident',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: incColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: incColor.withOpacity(0.3)),
                    ),
                    child: Text(
                      inc.type.toUpperCase(),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: incColor,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (!isResolved && _distanceStr != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 80,
              left: 16,
              right: 16,
              child: Align(
                alignment: Alignment.topCenter,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 500),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D4722),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: const [
                      BoxShadow(color: Colors.black26, blurRadius: 8),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.arrow_upward_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _distanceStr!,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const Text(
                              'Follow route to incident',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 160,
            left: 12,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color.fromRGBO(255, 255, 255, 0.9),
                borderRadius: BorderRadius.circular(8),
                boxShadow: const [
                  BoxShadow(color: Colors.black12, blurRadius: 8),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: incColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text('Incident', style: TextStyle(fontSize: 11)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: Colors.blue,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text('My location', style: TextStyle(fontSize: 11)),
                    ],
                  ),
                  if (_related.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: Colors.cyan,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'Backup unit',
                          style: TextStyle(fontSize: 11),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          Positioned(
            bottom: 150,
            right: 16,
            child: GestureDetector(
              onTap: _recenterMap,
              child: Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 8)],
                ),
                child: const Icon(Icons.my_location, color: Color(0xFF005953)),
              ),
            ),
          ),
          DraggableScrollableSheet(
            initialChildSize: 0.15,
            minChildSize: 0.15,
            maxChildSize: 0.7,
            snap: true,
            builder: (context, scrollController) {
              return Container(
                clipBehavior: Clip.hardEdge,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(24),
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black12,
                      blurRadius: 24,
                      offset: Offset(0, -8),
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  controller: scrollController,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          margin: const EdgeInsets.only(top: 12, bottom: 12),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade300,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 8,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (!isResolved && _distanceStr != null)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        _durationStr ?? '...',
                                        style: const TextStyle(
                                          fontSize: 24,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFb36b00),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        '🍃',
                                        style: TextStyle(
                                          fontSize: 18,
                                          color: Color(0xFF2e7d32),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const Text(
                                    ' • ',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              )
                            else
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    inc.status.toUpperCase().replaceAll(
                                      '_',
                                      ' ',
                                    ),
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const Text(
                                    'Navigating...',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            Container(
                              width: 48,
                              height: 48,
                              decoration: const BoxDecoration(
                                color: Color(0xFFffebeb),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                                color: Color(0xFFd32f2f),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                StatusBadge(status: inc.status),
                                const SizedBox(width: 10),
                                const Text(
                                  'Reported at ',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'CALLER',
                              style: TextStyle(
                                color: Colors.black54,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Text(
                              inc.citizenName ?? '—',
                              style: const TextStyle(fontSize: 15),
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'NOTES',
                              style: TextStyle(
                                color: Colors.black54,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Text(
                              inc.notes ?? 'Waiting for assignment specifics.',
                              style: const TextStyle(fontSize: 15),
                            ),
                            const SizedBox(height: 24),
                            if (!isResolved)
                              _acting
                                  ? const Center(
                                      child: CircularProgressIndicator(),
                                    )
                                  : Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        if (inc.status == 'dispatched')
                                          ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.black,
                                              foregroundColor: Colors.white,
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    vertical: 16,
                                                  ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(8),
                                              ),
                                            ),
                                            onPressed: () =>
                                                _updateStatus('in_progress'),
                                            child: const Text(
                                              'Slide to Arrive ➔',
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 16,
                                              ),
                                            ),
                                          ),
                                        if (inc.status == 'in_progress') ...[
                                          Row(
                                            children: [
                                              Expanded(
                                                child: OutlinedButton(
                                                  style: OutlinedButton.styleFrom(
                                                    foregroundColor:
                                                        Colors.black,
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          vertical: 16,
                                                        ),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            8,
                                                          ),
                                                    ),
                                                    side: const BorderSide(
                                                      color: Colors.grey,
                                                    ),
                                                  ),
                                                  onPressed: _requestSupport,
                                                  child: const Text(
                                                    'Call Backup',
                                                    style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      fontSize: 13,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: ElevatedButton(
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor:
                                                        const Color(0xFF2e7d32),
                                                    foregroundColor:
                                                        Colors.white,
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          vertical: 16,
                                                        ),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            8,
                                                          ),
                                                    ),
                                                  ),
                                                  onPressed: () =>
                                                      _updateStatus('resolved'),
                                                  child: const Text(
                                                    'Mark Resolved',
                                                    style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      fontSize: 13,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          TextButton(
                                            onPressed: () =>
                                                _updateStatus('dispatched'),
                                            style: TextButton.styleFrom(
                                              foregroundColor: Colors.grey,
                                            ),
                                            child: const Text(
                                              'Not on scene yet? Undo',
                                              style: TextStyle(fontSize: 13),
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                        ],
                                        if (inc.status == 'dispatched' ||
                                            inc.status == 'in_progress')
                                          OutlinedButton(
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: Theme.of(
                                                context,
                                              ).colorScheme.primary,
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    vertical: 16,
                                                  ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(8),
                                              ),
                                            ),
                                            onPressed: () => _requestSupport(),
                                            child: const Text(
                                              'Request Backup',
                                              style: TextStyle(fontSize: 15),
                                            ),
                                          ),
                                        if (inc.status == 'in_progress' && inc.destinationHospitalName != null) ...[
                                          const SizedBox(height: 8),
                                          ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.orange.shade700,
                                              foregroundColor: Colors.white,
                                              padding: const EdgeInsets.symmetric(vertical: 16),
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                            ),
                                            onPressed: () {
                                              if (_isUnderSimulation) {
                                                _resumeSimulation();
                                              } else {
                                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Drive to hospital (open external maps)')));
                                              }
                                            },
                                            child: Text(
                                              'Route to ${inc.destinationHospitalName}',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                              textAlign: TextAlign.center,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                            if (isResolved)
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 16,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                                onPressed: () => Navigator.of(context).pop(),
                                child: const Text(
                                  'Back to shift',
                                  style: TextStyle(fontSize: 15),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _SupportTypeSheet extends StatelessWidget {
  const _SupportTypeSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16.0),
            child: Text(
              'Request Additional Support',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.local_hospital, color: Colors.blue),
            title: const Text('Medical (Ambulance)'),
            onTap: () => Navigator.pop(context, 'ambulance'),
          ),
          ListTile(
            leading: const Icon(
              Icons.local_fire_department,
              color: Colors.orange,
            ),
            title: const Text('Fire (Fire Truck)'),
            onTap: () => Navigator.pop(context, 'fire_truck'),
          ),
          ListTile(
            leading: const Icon(Icons.local_police, color: Colors.indigo),
            title: const Text('Police (Cruiser)'),
            onTap: () => Navigator.pop(context, 'police_car'),
          ),
        ],
      ),
    );
  }
}
