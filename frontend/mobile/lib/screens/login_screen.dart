import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtl = TextEditingController();
  final _passCtl = TextEditingController();

  bool _loading = false;
  String _error = '';

  @override
  void dispose() {
    _emailCtl.dispose();
    _passCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final auth = context.read<AuthProvider>();
      await auth.login(_emailCtl.text.trim(), _passCtl.text);
      // Only first responders may use the mobile app
      if (auth.user?.role != UserRole.firstResponder) {
        await auth.logout();
        if (mounted) {
          setState(() {
            _error =
                'This app is for first responders only. Please use the web portal.';
          });
        }
        return;
      }
      // Nav happens automatically via _AppRoot listening to auth.isAuthenticated
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Row
                    Row(
                      children: [
                        Container(
                          width: 32, height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('N', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                        ),
                        const SizedBox(width: 10),
                        const Text('NERDCO', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, letterSpacing: -0.3)),
                      ],
                    ),
                    const SizedBox(height: 32),
                    
                    const Text('Responder Portal', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24, letterSpacing: -0.5)),
                    const SizedBox(height: 6),
                    const Text('Secure access for emergency personnel.', style: TextStyle(fontSize: 14, color: Colors.black54)),
                    const SizedBox(height: 28),

                    if (_error.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          border: Border.all(color: Colors.red.shade200),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(_error, style: TextStyle(color: Colors.red.shade900, fontSize: 14)),
                      ),

                    // Email Field
                    TextFormField(
                      controller: _emailCtl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      cursorColor: Colors.black,
                      decoration: InputDecoration(
                        labelText: 'Email Address',
                        labelStyle: const TextStyle(color: Colors.black54),
                        focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.black, width: 2)),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      validator: (v) => v == null || v.isEmpty ? 'Email is required' : null,
                    ),
                    const SizedBox(height: 16),

                    // Password Field
                    TextFormField(
                      controller: _passCtl,
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      cursorColor: Colors.black,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        labelStyle: const TextStyle(color: Colors.black54),
                        focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.black, width: 2)),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      validator: (v) => v == null || v.isEmpty ? 'Password is required' : null,
                    ),
                    
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        style: TextButton.styleFrom(foregroundColor: Colors.black54),
                        child: const Text('Forgot password?', style: TextStyle(decoration: TextDecoration.underline)),
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Submit Button
                    ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: _loading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Sign in', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    ),

                    const SizedBox(height: 32),
                    
                    // Dev Box
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                            ),
                            child: const Text('QUICK LOGIN (DEV)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black54)),
                          ),
                          _buildDevItem('Responder 1', 'amb1@nerdco.local'),
                          _buildDevItem('Responder 2', 'amb2@nerdco.local'),
                          _buildDevItem('Police 1', 'pd1@nerdco.local'),
                          _buildDevItem('Fire 1', 'fd1@nerdco.local'),
                        ],
                      ),
                    )
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDevItem(String title, String email) {
    return InkWell(
      onTap: () {
        _emailCtl.text = email;
        _passCtl.text = 'password123';
        _submit();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: Colors.grey.shade200)),
        ),
        child: Row(
          children: [
            const Icon(Icons.person_outline, size: 16, color: Colors.black54),
            const SizedBox(width: 10),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const Spacer(),
            Text(email, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
      ),
    );
  }
}
