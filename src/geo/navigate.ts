export type NavApp = 'google' | 'apple' | 'waze' | 'osmand' | 'organicmaps' | 'geo';

interface NavTarget {
  lat: number;
  lon: number;
  label?: string;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/** Costruisce l'URL/URI per aprire la navigazione verso un punto in un'app esterna. */
export function buildNavigationUrl(app: NavApp, target: NavTarget): string {
  const { lat, lon, label } = target;
  const name = encodeURIComponent(label ?? 'Idrante');
  switch (app) {
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    case 'waze':
      return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
    case 'osmand':
      // Schema URI supportato da OsmAnd per navigazione punto-a-punto anche offline.
      return `osmand.geo:${lat},${lon}?q=${lat},${lon}(${name})`;
    case 'organicmaps':
      return `om://map?ll=${lat},${lon}&n=${name}`;
    case 'geo':
    default:
      // Schema generico "geo:" — Android lascia scegliere l'app di navigazione predefinita.
      return `geo:${lat},${lon}?q=${lat},${lon}(${name})`;
  }
}

/** Apre l'app di navigazione scelta. Consigliata Google/Apple Maps in base alla piattaforma. */
export function openNavigation(app: NavApp, target: NavTarget): void {
  const url = buildNavigationUrl(app, target);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Suggerisce l'app di mappe "nativa" più probabile per la piattaforma corrente. */
export function defaultNavApp(): NavApp {
  return isIOS() ? 'apple' : 'geo';
}

export const NAV_APPS: { id: NavApp; label: string }[] = [
  { id: 'google', label: 'Google Maps' },
  { id: 'apple', label: 'Apple Maps' },
  { id: 'waze', label: 'Waze' },
  { id: 'osmand', label: 'OsmAnd (offline)' },
  { id: 'organicmaps', label: 'Organic Maps (offline)' }
];
