import 'package:flutter/material.dart';

/// NERDCO Design Tokens
///
/// Single source of truth for all semantic colors, sizing, and typography
/// constants used across the mobile app. All colors are NAPSG-aligned per
/// design/ux_logic.md §3 and §8. No hardcoded hex values should appear outside
/// this file.
///
/// Usage: import 'package:mobile/config/design_tokens.dart';

// ── Semantic Status Colors (NAPSG v5.0 aligned, ux_logic.md §8) ──────────────

class NerdcoColors {
  NerdcoColors._();

  // Incident type / priority
  static const Color medical    = Color(0xFFE63946); // Red — life-safety
  static const Color fire       = Color(0xFFF26419); // Orange — fire/hazmat
  static const Color police     = Color(0xFF1565C0); // Dark Blue — law enforcement
  static const Color other      = Color(0xFF888888); // Grey — general/unknown

  // Vehicle / resource status
  static const Color available  = Color(0xFF107C10); // Green
  static const Color dispatched = Color(0xFFFF8C00); // Amber
  static const Color inProgress = Color(0xFF0078D4); // Blue
  static const Color unavailable = Color(0xFF797775); // Grey

  // Route / navigation
  static const Color routeLine  = Color(0xFF4285F4);

  // Warning banner (GPS missing, connectivity)
  static const Color warningBg     = Color(0xFFFFF3CD);
  static const Color warningBorder = Color(0xFFFFCA28);
  static const Color warningText   = Color(0xFF4E342E);

  // Neutral / UI
  static const Color surfaceDark   = Color(0xFF1E293B);
  static const Color backgroundDark = Color(0xFF0D1117);
}

// ── Typography Minimums (ux_logic.md §7) ────────────────────────────────────

class NerdcoText {
  NerdcoText._();

  static const double bodyMin    = 14.0;  // sp — minimum for body text
  static const double labelMin   = 12.0;  // sp — minimum for labels/captions
  static const double headingMin = 16.0;  // sp — minimum for headings
}

// ── Sizing (ux_logic.md §4 — touch targets) ─────────────────────────────────

class NerdcoSizing {
  NerdcoSizing._();

  static const double touchMin   = 48.0;  // dp — WCAG minimum touch target
  static const double touchField = 56.0;  // dp — field responder (gloved use)
  static const double radius     = 8.0;   // dp — standard border radius
  static const double radiusLg   = 12.0;  // dp — card/sheet border radius
}
