import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../services/auth_service.dart';

/// First-responder profile editing screen.
/// Mirrors the web /field/profile page:
///   - Editable name field
///   - Read-only email + role display
///   - PATCH /auth/profile to save name changes
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _svc      = AuthService();
  final _nameCtrl = TextEditingController();
  bool    _saving  = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameCtrl.text = user?.name ?? '';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  String get _token => context.read<AuthProvider>().user?.accessToken ?? '';

  String _roleLabel(UserRole role) {
    switch (role) {
      case UserRole.systemAdmin:    return 'System Admin';
      case UserRole.orgAdmin:       return 'Org Admin';
      case UserRole.firstResponder: return 'First Responder';
    }
  }

  Future<void> _save() async {
    final name  = _nameCtrl.text.trim();
    final token = _token;                       // capture before async gap
    if (name.isEmpty) return;
    setState(() { _saving = true; _error = null; _success = null; });
    try {
      await _svc.updateName(token, name);
      if (!mounted) return;
      // Update the in-memory user so the app bar shows the new name immediately
      context.read<AuthProvider>().updateName(name);
      setState(() => _success = 'Profile updated successfully.');
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user    = context.watch<AuthProvider>().user;
    final cs      = Theme.of(context).colorScheme;
    final origName = user?.name ?? '';
    final changed  = _nameCtrl.text.trim() != origName &&
                     _nameCtrl.text.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // ── Avatar banner ────────────────────────────────────────────
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: cs.primary,
                  child: Text(
                    (user?.name.isNotEmpty ?? false)
                        ? user!.name[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                      fontSize: 32, color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  user?.name ?? '',
                  style: Theme.of(context)
                      .textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                if (user != null)
                  Text(
                    _roleLabel(user.role),
                    style: Theme.of(context)
                        .textTheme.bodySmall
                        ?.copyWith(color: cs.onSurfaceVariant),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          // ── Account settings card ─────────────────────────────────────
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: cs.outlineVariant),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Account Settings',
                    style: Theme.of(context)
                        .textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 20),

                  // Name (editable)
                  TextFormField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Full Name',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    onChanged: (_) => setState(() {}),
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) { if (changed) _save(); },
                  ),
                  const SizedBox(height: 16),

                  // Email (read-only)
                  TextFormField(
                    initialValue: user?.email ?? '',
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Email Address',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    style: TextStyle(color: cs.onSurfaceVariant),
                  ),
                  const SizedBox(height: 16),

                  // Role (read-only)
                  TextFormField(
                    initialValue: user != null ? _roleLabel(user.role) : '',
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Role',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                    style: TextStyle(color: cs.onSurfaceVariant),
                  ),

                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!,
                        style: TextStyle(color: cs.error, fontSize: 13)),
                  ],
                  if (_success != null) ...[
                    const SizedBox(height: 12),
                    Text(_success!,
                        style: TextStyle(
                            color: Colors.green.shade700, fontSize: 13)),
                  ],

                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: (changed && !_saving) ? _save : null,
                      child: _saving
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Text('Save Changes'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // ── Sign out ──────────────────────────────────────────────────
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: cs.outlineVariant),
            ),
            child: ListTile(
              leading: Icon(Icons.logout, color: cs.error),
              title: Text(
                'Sign Out',
                style: TextStyle(
                    color: cs.error, fontWeight: FontWeight.w600),
              ),
              onTap: () => context.read<AuthProvider>().logout(),
            ),
          ),
        ],
      ),
    );
  }
}
