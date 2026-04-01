import 'package:flutter/material.dart';
import 'package:mobile/config/design_tokens.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onFinish;
  const OnboardingScreen({super.key, required this.onFinish});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _currentPage = 0;

  final List<Map<String, dynamic>> _pages = [
    {
      'title': 'Welcome to NERDCO',
      'body': 'Receive real-time medical, fire, and police dispatch alerts straight to your vehicle.',
      'icon': Icons.cell_tower_rounded,
    },
    {
      'title': 'Live Navigation',
      'body': 'Get turn-by-turn routing to incident scenes and receiving hospitals, updated live.',
      'icon': Icons.map_rounded,
    },
    {
      'title': 'Status Updates',
      'body': 'Keep the control center updated with your availability and status with a single tap.',
      'icon': Icons.check_circle_outline_rounded,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (idx) => setState(() => _currentPage = idx),
                itemCount: _pages.length,
                itemBuilder: (context, idx) {
                  final page = _pages[idx];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 40),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: cs.primaryContainer,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(page['icon'], size: 80, color: cs.primary),
                        ),
                        const SizedBox(height: 56),
                        Text(
                          page['title'],
                          style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: cs.onSurface),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          page['body'],
                          style: TextStyle(fontSize: 16, color: cs.onSurfaceVariant, height: 1.5),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Column(
                children: [
                  // Page indicator dots
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (idx) => Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: _currentPage == idx ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: _currentPage == idx ? cs.primary : cs.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    )),
                  ),
                  const SizedBox(height: 16),
                  // Navigation row: Skip | Next/Get Started
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Skip — min 48dp touch target
                      TextButton(
                        onPressed: widget.onFinish,
                        style: TextButton.styleFrom(
                          foregroundColor: cs.onSurfaceVariant,
                          minimumSize: const Size(64, NerdcoSizing.touchMin),
                        ),
                        child: const Text('Skip'),
                      ),
                      // Next / Get Started — 56dp field-responder size
                      ElevatedButton(
                        onPressed: () {
                          if (_currentPage == _pages.length - 1) {
                            widget.onFinish();
                          } else {
                            _controller.nextPage(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeInOut,
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: cs.primary,
                          foregroundColor: cs.onPrimary,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(NerdcoSizing.radius),
                          ),
                          minimumSize: const Size(120, NerdcoSizing.touchField),
                        ),
                        child: Text(_currentPage == _pages.length - 1 ? 'Get Started' : 'Next'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
