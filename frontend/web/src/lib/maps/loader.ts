/**
 * Singleton Google Maps JS API loader.
 *
 * The Maps API must only be added to the DOM once per page lifetime.
 * Using a module-level promise means every component that calls loadGoogleMaps()
 * gets the same promise — subsequent calls are no-ops that resolve immediately.
 *
 * This prevents the "Google Maps included multiple times" error that occurs when
 * React HMR or multiple components each append their own <script> tag.
 */

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  // Already fully loaded (including marker library)
  if (typeof window !== 'undefined' && window.google?.maps?.marker) {
    return Promise.resolve();
  }

  // In-flight or already queued
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    (window as any).__gmapsInit = () => {
      resolve();
      delete (window as any).__gmapsInit;
    };
    
    const script = document.createElement('script');
    // loading=async is the recommended pattern — avoids the console warning
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker&callback=__gmapsInit`;
    script.async = true;
    script.defer = true;
    script.onerror = () => { loadPromise = null; reject(new Error('Google Maps failed to load')); };
    document.head.appendChild(script);
  });

  return loadPromise;
}
