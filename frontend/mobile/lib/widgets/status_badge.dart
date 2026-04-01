import 'package:flutter/material.dart';
import 'package:mobile/config/design_tokens.dart';

/// Coloured chip for incident or vehicle status.
/// Colors follow NAPSG v5.0 conventions defined in design/ux_logic.md §8
/// and NerdcoColors tokens in design_tokens.dart.
class StatusBadge extends StatelessWidget {
  final String status;
  final bool small;

  const StatusBadge({super.key, required this.status, this.small = false});

  @override
  Widget build(BuildContext context) {
    final (label, color) = _resolve(status);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: EdgeInsets.symmetric(
        horizontal: small ? 6 : 10,
        vertical:   small ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color:        color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border:       Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color:      color,
          fontSize:   small ? NerdcoText.labelMin : NerdcoText.labelMin,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  static (String, Color) _resolve(String s) {
    switch (s) {
      case 'created':     return ('Created',     NerdcoColors.dispatched);
      case 'dispatched':  return ('Dispatched',  NerdcoColors.inProgress);
      case 'in_progress': return ('In Progress', NerdcoColors.medical);
      case 'resolved':    return ('Resolved',    NerdcoColors.available);
      case 'available':   return ('Available',   NerdcoColors.available);
      case 'unavailable': return ('Unavailable', NerdcoColors.unavailable);
      default:            return (s,             NerdcoColors.other);
    }
  }
}
