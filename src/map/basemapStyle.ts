import { Protocol } from 'pmtiles';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';

let protocolRegistered = false;

/** Registra lo schema "pmtiles://" per MapLibre, usato per basemap 100% offline. */
export function registerPmtilesProtocol(): void {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
}

/**
 * Stile di fallback online: tile raster OpenStreetMap. Il Service Worker le
 * mette in cache (CacheFirst) man mano che l'utente naviga la mappa, quindi
 * le zone già visitate restano disponibili offline alla visita successiva.
 */
export const RASTER_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  // Necessario per i simboli di testo (es. conteggio cluster). Font pubblici
  // del progetto MapLibre demotiles: nessuna chiave richiesta.
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }
  ]
};

async function existsOnServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    // In dev, il middleware SPA di Vite risponde 200 con index.html per
    // qualunque path assente: uno scarto sul content-type evita il falso positivo.
    const type = res.headers.get('content-type') ?? '';
    return !type.includes('text/html');
  } catch {
    return false;
  }
}

/**
 * Se l'operatore ha copiato una basemap vettoriale offline in
 * public/data/basemap.pmtiles + public/data/basemap-style.json, la usa;
 * altrimenti torna allo stile raster online (cache-first) di default.
 * Vedi README.md § "Basemap offline" per come generarla.
 */
export async function resolveBasemapStyle(): Promise<StyleSpecification | string> {
  registerPmtilesProtocol();
  const hasPmtiles = await existsOnServer(`${import.meta.env.BASE_URL}data/basemap.pmtiles`);
  const hasStyle = hasPmtiles && (await existsOnServer(`${import.meta.env.BASE_URL}data/basemap-style.json`));
  if (hasStyle) return `${import.meta.env.BASE_URL}data/basemap-style.json`;
  return RASTER_FALLBACK_STYLE;
}
