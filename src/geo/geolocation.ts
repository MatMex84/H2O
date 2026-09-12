import type { UserPosition } from '../types';

export type GpsStatus = 'idle' | 'locating' | 'active' | 'denied' | 'unavailable';

export interface GeoWatcher {
  stop: () => void;
}

/**
 * Avvia il tracking GPS continuo. onUpdate riceve ogni fix; onStatus riceve i
 * cambi di stato per l'indicatore nella barra superiore.
 */
export function watchPosition(
  onUpdate: (pos: UserPosition) => void,
  onStatus: (status: GpsStatus) => void
): GeoWatcher {
  if (!('geolocation' in navigator)) {
    onStatus('unavailable');
    return { stop: () => {} };
  }

  onStatus('locating');
  const id = navigator.geolocation.watchPosition(
    (p) => {
      onStatus('active');
      onUpdate({
        lon: p.coords.longitude,
        lat: p.coords.latitude,
        accuracyMeters: p.coords.accuracy ?? null,
        headingDeg: p.coords.heading ?? null,
        timestamp: p.timestamp
      });
    },
    (err) => {
      onStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );

  return { stop: () => navigator.geolocation.clearWatch(id) };
}

/** Singolo fix "una tantum", usato per centrare la mappa all'avvio. */
export function getCurrentPositionOnce(): Promise<UserPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocalizzazione non disponibile su questo dispositivo/browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lon: p.coords.longitude,
          lat: p.coords.latitude,
          accuracyMeters: p.coords.accuracy ?? null,
          headingDeg: p.coords.heading ?? null,
          timestamp: p.timestamp
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}
