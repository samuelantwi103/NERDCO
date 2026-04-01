/// Base URLs for each backend service.
/// Updated to point to hosted Render URLs.
class ApiConfig {
  static const String authUrl = 'https://nerdco-auth.onrender.com';
  static const String incidentUrl = 'https://nerdco-incident.onrender.com';
  static const String trackingUrl = 'https://nerdco-tracking.onrender.com';
  static const String analyticsUrl = 'https://nerdco-analytics.onrender.com';

  /// WebSocket endpoint for live vehicle positions
  static const String vehicleWsUrl =
      'wss://nerdco-tracking.onrender.com/ws/vehicles';
}
