import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'dashboard_screen.dart';

/// Role-based routing hub. Currently all field roles land on DashboardScreen.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      // Should not happen — router guards this
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // All three field roles see the same shift dashboard
    return const DashboardScreen();
  }
}
