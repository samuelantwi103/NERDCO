/**
 * Shared map info popup utility for all Google Maps pages.
 * Shows a non-blocking floating popup anchored above a marker.
 * Dismissed by clicking elsewhere on the map (caller must set up map 'click' listener).
 *
 * Per ux_logic.md §9: max 5 lines, never blocks navigation, dismissed by clicking elsewhere.
 */

export interface InfoData {
  title: string;
  lines: string[];
}

export function showInfoPopup(
  mapContainer: HTMLElement,
  anchor: google.maps.marker.AdvancedMarkerElement,
  _map: google.maps.Map,
  data: InfoData,
  popupRef: { current: HTMLElement | null }
): void {
  // Remove any existing popup
  popupRef.current?.remove();

  const popup = document.createElement('div');
  popup.style.cssText = `
    position:absolute;z-index:20;
    background:#fff;border:1px solid #e0e0e0;border-radius:10px;
    padding:10px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.18);
    min-width:180px;max-width:260px;pointer-events:none;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;line-height:1.5;
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:4px;';
  title.textContent = data.title;
  popup.appendChild(title);

  data.lines.slice(0, 5).forEach(line => {
    const p = document.createElement('div');
    p.style.cssText = 'color:#555;font-size:12px;';
    p.textContent = line;
    popup.appendChild(p);
  });

  mapContainer.style.position = 'relative';
  mapContainer.appendChild(popup);
  popupRef.current = popup;

  // Position popup above marker using its DOM element's bounding rect
  const markerEl = anchor.content as HTMLElement | null;
  if (markerEl) {
    const mRect = markerEl.getBoundingClientRect();
    const cRect = mapContainer.getBoundingClientRect();
    const left  = mRect.left - cRect.left + mRect.width / 2;
    const top   = mRect.top  - cRect.top  - 8;
    popup.style.left      = `${left}px`;
    popup.style.top       = `${top}px`;
    popup.style.transform = 'translate(-50%, -100%)';
  }
}

export function dismissInfoPopup(popupRef: { current: HTMLElement | null }): void {
  popupRef.current?.remove();
  popupRef.current = null;
}
