import re

with open('src/app/(field)/field/incident/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add state for navigation info
text = text.replace(
    "const polylineRef     = useRef<google.maps.Polyline | null>(null);",
    "const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);\n  const [navInfo, setNavInfo] = useState<any>(null);"
)

# 2. Update routing logic
routing_logic_old = """    // Draw route once per incident load
    if (!routeFetchedRef.current && incident && (incident.status === 'dispatched' || incident.status === 'in_progress')) {
      routeFetchedRef.current = true;
      const lat = parseFloat(incident.latitude);
      const lng = parseFloat(incident.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        polylineRef.current = new google.maps.Polyline({
          path: [myLocation, { lat, lng }],
          map: mapRef.current!,
          strokeColor: '#4285F4',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        });
      }
    }"""
routing_logic_new = """    // Draw route once per incident load
    if (!routeFetchedRef.current && incident && (incident.status === 'dispatched' || incident.status === 'in_progress')) {
      routeFetchedRef.current = true;
      const lat = parseFloat(incident.latitude);
      const lng = parseFloat(incident.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const ds = new google.maps.DirectionsService();
        const dr = new google.maps.DirectionsRenderer({
          map: mapRef.current!,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#4285F4', strokeWeight: 6, strokeOpacity: 0.9 },
        });
        directionsRendererRef.current = dr;
        
        ds.route({
          origin: myLocation,
          destination: { lat, lng },
          travelMode: google.maps.TravelMode.DRIVING,
        }, (res, status) => {
          if (status === 'OK' && res) {
            dr.setDirections(res);
            const route = res.routes[0];
            const leg = route.legs[0];
            const step = leg.steps[0];
            setNavInfo({
              distance: leg.distance?.text,
              duration: leg.duration?.text,
              nextStepDist: step?.distance?.text,
              nextStepText: step?.instructions?.replace(/<[^>]*>?/gm, ''), // strip html
              maneuver: step?.maneuver
            });
          }
        });
      }
    }"""
text = text.replace(routing_logic_old, routing_logic_new)

# 3. Add styles to mapBox and add overlay styles
styles_old = "mapBox: { height: '50vh', position: 'relative', background: 'var(--color-bg)' },"
styles_new = """mapBox: { height: '50vh', position: 'relative', background: 'var(--color-bg)', overflow: 'hidden' },
  navTopBox: {
    position: 'absolute', top: '16px', left: '16px', right: '16px',
    background: '#0d4722', color: '#fff', borderRadius: '12px', padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100,
  },
  navBottomBox: {
    position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: '#fff', borderRadius: '24px', padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, minWidth: '200px'
  },
  navMainText: { fontSize: '20px', fontWeight: 'bold' },
  navSubText: { fontSize: '14px', opacity: 0.9 },
  durationText: { fontSize: '20px', fontWeight: 'bold', color: '#b36b00' },
  distanceText: { fontSize: '14px', color: '#666' },"""
text = text.replace(styles_old, styles_new)

# 4. Insert Navigation UI inside Map container
map_ui_old = """<div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />"""
map_ui_new = """<div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            {navInfo && (
              <>
                <div className={styles.navTopBox}>
                  {/* Arrow Icon Placeholder */}
                  <div style={{ flex: 1 }}>
                    <div className={styles.navMainText}>{navInfo.nextStepDist}</div>
                    <div className={styles.navMainText}>{navInfo.nextStepText}</div>
                  </div>
                </div>
                <div className={styles.navBottomBox}>
                  <div className={styles.durationText}>{navInfo.duration}</div>
                  <div className={styles.distanceText}>{navInfo.distance}</div>
                </div>
              </>
            )}"""
text = text.replace(map_ui_old, map_ui_new)

with open('src/app/(field)/field/incident/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Patch complete")
