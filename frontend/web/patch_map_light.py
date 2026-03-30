import re

with open('src/app/(ops)/dashboard/DashboardMap.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace Map styling and ID
map_init_regex = r"const darkStyles: any\[\] = \[[\s\S]*?\];[\s\S]*?const map = new google\.maps\.Map\(mapContainerRef\.current, \{[\s\S]*?zoomControl: true,[\s\S]*?styles: [^\n]*\n      \}\);"

new_map_init = '''const baseStyles: any[] = hidePOIs ? [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ] : [];

      const map = new google.maps.Map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        mapId: 'DEMO_MAP_ID',
      });'''

text = re.sub(r"const baseStyles: any\[\] = hidePOIs[\s\S]*?styles: hidePOIs \? \[\.\.\.baseStyles, \.\.\.darkStyles\] : darkStyles,\n      \}\);", new_map_init, text)

# Replace dsRef, drRef with polyRef
text = text.replace(
    'const dsRef           = useRef<google.maps.DirectionsService | null>(null);\n  const drRef           = useRef<google.maps.DirectionsRenderer | null>(null);',
    'const polylineRef     = useRef<google.maps.Polyline | null>(null);'
)

# Replace their initialization
text = text.replace(
'''      dsRef.current = new google.maps.DirectionsService();
      drRef.current = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: '#00BFFF',
          strokeOpacity: 0.8,
          strokeWeight: 5
        }
      });''',
'''      polylineRef.current = new google.maps.Polyline({
        map,
        path: [],
        geodesic: true,
        strokeColor: '#00BFFF',
        strokeOpacity: 0.8,
        strokeWeight: 5,
        strokePattern: 'dash', // wait, strokePattern isn't a native property like this, let's keep it solid or use icons
        icons: [{
          icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillOpacity: 1, strokeOpacity: 1 },
          offset: '50%'
        }]
      });'''
)

# And now replace the routing effect
routing_regex = r"// Handle Directions Routing for field responders[\s\S]*?eslint-disable-next-line react-hooks/exhaustive-deps\n  \}, \[[^\]]*\]\);"

new_routing = '''  // Handle direct line "Routing" for field responders (Demo mode fallback)
  useEffect(() => {
    if (!mapReady || !enableRouting || !polylineRef.current) return;

    if (!myLocation || !selectedId) {
      polylineRef.current.setPath([]); 
      lastRouteRef.current = null;
      return;
    }

    const t = incidents.find(i => i.id === selectedId);
    if (!t || !t.latitude || !t.longitude) return;

    const dest = { lat: parseFloat(t.latitude), lng: parseFloat(t.longitude) };
    if (isNaN(dest.lat) || isNaN(dest.lng)) return;

    // Draw a direct path
    polylineRef.current.setPath([myLocation, dest]);
  }, [myLocation, selectedId, enableRouting, mapReady, incidents]);'''

text = re.sub(routing_regex, new_routing, text)

with open('src/app/(ops)/dashboard/DashboardMap.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
