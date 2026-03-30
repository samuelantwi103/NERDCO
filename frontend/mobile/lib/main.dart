import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/network_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'config/app_theme.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => NetworkProvider()),
      ],
      child: const NerdcoApp(),
    ),
  );
}

class NerdcoApp extends StatelessWidget {
  const NerdcoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'NERDCO Field',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode
          .light, // Default to light theme, keeping darkTheme available
      home: const _AppRoot(),
      routes: {
        '/login': (_) => const LoginScreen(),
        '/home': (_) => const HomeScreen(),
        '/forgot-password': (_) => const ForgotPasswordScreen(),
      },
    );
  }
}

/// Checks stored session on app start. Shows login or home accordingly.
class _AppRoot extends StatefulWidget {
  const _AppRoot();

  @override
  State<_AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<_AppRoot> {
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    await context.read<AuthProvider>().tryRestoreSession();
    if (mounted) setState(() => _checking = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final auth = context.watch<AuthProvider>();
    final isOnline = context.watch<NetworkProvider>().isOnline;

    return Column(
      children: [
        if (!isOnline)
          Builder(
            builder: (ctx) {
              final cs = Theme.of(ctx).colorScheme;
              return Material(
                color: cs.errorContainer,
                child: SafeArea(
                  bottom: false,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.wifi_off_rounded,
                          size: 16,
                          color: cs.onErrorContainer,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'No Internet Connection — Offline Mode',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: cs.onErrorContainer,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        Expanded(
          child: auth.isAuthenticated
              ? const HomeScreen()
              : const LoginScreen(),
        ),
      ],
    );
  }
}
