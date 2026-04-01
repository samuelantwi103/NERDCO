import 'dart:ui' as ui;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Generates a custom Map Marker Bitmap perfectly matching the NAPSG standards 
/// built in the Web Dashboard (White thick border, solid colored circle, flat white SVG shape inside).
Future<BitmapDescriptor> createNapsgMarkerBitmap(String type, Color color, {double size = 96}) async {
  final ui.PictureRecorder pictureRecorder = ui.PictureRecorder();
  final Canvas canvas = Canvas(pictureRecorder);

  // Background
  final Paint backgroundPaint = Paint()
    ..color = color
    ..style = PaintingStyle.fill;
    
  // Border
  final Paint borderPaint = Paint()
    ..color = Colors.white
    ..style = PaintingStyle.stroke
    ..strokeWidth = size * 0.08
    ..strokeJoin = StrokeJoin.round;

  // Icon
  final Paint iconPaint = Paint()
    ..color = Colors.white
    ..style = PaintingStyle.fill;

  // Draw the main circle
  final double radius = size / 2;
  canvas.drawCircle(Offset(radius, radius), radius - borderPaint.strokeWidth / 2, backgroundPaint);
  canvas.drawCircle(Offset(radius, radius), radius - borderPaint.strokeWidth / 2, borderPaint);

  canvas.save();
  // The paths assume a 24x24 coordinate system. We scale it down to ~60% of the marker size
  // and center it.
  final double scale = (size * 0.55) / 24.0;
  final double offset = (size - 24.0 * scale) / 2;
  canvas.translate(offset, offset);
  canvas.scale(scale, scale);

  Path path = Path();
  if (type == 'medical') {
    // Cross
    path.moveTo(19, 13.5);
    path.lineTo(13.5, 13.5);
    path.lineTo(13.5, 19);
    path.lineTo(10.5, 19);
    path.lineTo(10.5, 13.5);
    path.lineTo(5, 13.5);
    path.lineTo(5, 10.5);
    path.lineTo(10.5, 10.5);
    path.lineTo(10.5, 5);
    path.lineTo(13.5, 5);
    path.lineTo(13.5, 10.5);
    path.lineTo(19, 10.5);
    path.close();
  } else if (type == 'fire') {
    // High-fidelity flame
    path.moveTo(19.48, 12.35);
    path.cubicTo(17.91, 8.27, 12.32, 8.05, 13.67, 2.12);
    path.quadraticBezierTo(10.32, 4.23, 9.94, 7.71);
    path.cubicTo(7.72, 13.06, 7, 14.33, 7, 15.6);
    path.arcToPoint(const Offset(12, 15.6), radius: const Radius.circular(5), clockwise: true);
    path.arcToPoint(const Offset(17, 15.6), radius: const Radius.circular(5), clockwise: true);
    path.cubicTo(17, 14.38, 16.61, 13.24, 15.98, 12.35);
    path.close();
  } else if (type == 'crime' || type == 'police') {
    // High-fidelity shield
    path.moveTo(12, 1);
    path.lineTo(3, 5);
    path.lineTo(3, 11);
    path.cubicTo(3, 16.55, 6.84, 21.74, 12, 23);
    path.cubicTo(17.16, 21.74, 21, 16.55, 21, 11);
    path.lineTo(21, 5);
    path.close();
    // Inner badge shape
    path.moveTo(12, 11.99);
    path.lineTo(19, 11.99);
    path.cubicTo(18.47, 16.11, 15.72, 19.78, 12, 20.93);
    path.lineTo(12, 12);
    path.lineTo(5, 12);
    path.lineTo(5, 6.3);
    path.lineTo(12, 3.19);
    path.close();
  } else {
    // Default Dot
    path.addOval(Rect.fromLTWH(6, 6, 12, 12));
  }
  
  // Need to set path fill type to evenOdd to correctly handle cutouts (like the shield)
  path.fillType = PathFillType.evenOdd;
  canvas.drawPath(path, iconPaint);
  canvas.restore();

  final ui.Image image = await pictureRecorder.endRecording().toImage(size.toInt(), size.toInt());
  final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  final Uint8List res = byteData!.buffer.asUint8List();

  return BitmapDescriptor.bytes(res);
}
