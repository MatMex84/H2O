import maplibregl, { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Hydrant, StatoIdrante } from '../types';
import { STATO_COLOR } from '../types';
import { resolveBasemapStyle } from './basemapStyle';

export interface HydrantMapOptions {
  container: HTMLElement;
  onSelectHydrant: (id: string) => void;
  onMoveEnd?: () => void;
}

const SOURCE_ID = 'idranti';
const CLUSTER_LAYER = 'idranti-cluster';
const CLUSTER_COUNT_LAYER = 'idranti-cluster-count';
const POINT_LAYER = 'idranti-point';
const USER_SOURCE_ID = 'user-position';
const USER_LAYER = 'user-position-dot';

function toFeatureCollection(hydrants: Hydrant[]) {
  return {
    type: 'FeatureCollection' as const,
    features: hydrants.map((h) => ({
      type: 'Feature' as const,
      id: h.id,
      geometry: { type: 'Point' as const, coordinates: [h.lon, h.lat] },
      properties: { id: h.id, stato: h.stato }
    }))
  };
}

const STATO_MATCH_EXPR: any[] = ['match', ['get', 'stato']];
(Object.keys(STATO_COLOR) as StatoIdrante[]).forEach((k) => {
  STATO_MATCH_EXPR.push(k, STATO_COLOR[k]);
});
STATO_MATCH_EXPR.push(STATO_COLOR.sconosciuto);

export class HydrantMap {
  readonly map: MlMap;
  private opts: HydrantMapOptions;
  private ready: Promise<void>;

  /** Usare HydrantMap.create(...): risolve prima lo stile della basemap,
   *  poi crea la mappa già con lo stile definitivo (evita un doppio
   *  caricamento stile e le relative race condition sugli eventi). */
  static async create(opts: HydrantMapOptions): Promise<HydrantMap> {
    const style = await resolveBasemapStyle();
    return new HydrantMap(opts, style);
  }

  private constructor(opts: HydrantMapOptions, style: any) {
    this.opts = opts;
    this.map = new maplibregl.Map({
      container: opts.container,
      style,
      center: [12.4964, 41.9028], // Roma, fallback prima del GPS
      zoom: 5,
      attributionControl: { compact: true },
      maxPitch: 0,
      dragRotate: false,
      touchPitch: false
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    this.ready = new Promise<void>((resolve) => {
      this.map.once('load', () => {
        this.addLayers();
        this.wireEvents();
        if (this.opts.onMoveEnd) this.map.on('moveend', this.opts.onMoveEnd);
        resolve();
      });
    });
  }

  private addLayers(): void {
    if (this.map.getSource(SOURCE_ID)) return;

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: 55,
      clusterMaxZoom: 15
    });

    this.map.addLayer({
      id: CLUSTER_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#0b3d5c',
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-radius': ['step', ['get', 'point_count'], 18, 25, 24, 100, 30, 750, 38]
      }
    });

    try {
      // Richiede una "glyphs" URL nello stile attivo: se lo stile custom
      // dell'operatore non la fornisce, i cluster restano senza numero ma
      // il resto della mappa (punti, basemap) continua a funzionare.
      this.map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 14
        },
        paint: { 'text-color': '#ffffff' }
      });
    } catch (err) {
      console.warn('Etichette conteggio cluster disabilitate (stile senza glyphs):', err);
    }

    this.map.addLayer({
      id: POINT_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 9, 18, 14],
        'circle-color': STATO_MATCH_EXPR as any,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    this.map.addSource(USER_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    this.map.addLayer({
      id: `${USER_LAYER}-halo`,
      type: 'circle',
      source: USER_SOURCE_ID,
      paint: { 'circle-radius': 14, 'circle-color': '#1a73e8', 'circle-opacity': 0.25 }
    });
    this.map.addLayer({
      id: USER_LAYER,
      type: 'circle',
      source: USER_SOURCE_ID,
      paint: {
        'circle-radius': 7,
        'circle-color': '#1a73e8',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });
  }

  private wireEvents(): void {
    this.map.on('click', POINT_LAYER, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const id = String(f.properties?.id);
      this.opts.onSelectHydrant(id);
    });

    this.map.on('click', CLUSTER_LAYER, async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id;
      const source = this.map.getSource(SOURCE_ID) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      this.map.easeTo({ center: (f.geometry as any).coordinates, zoom });
    });

    this.map.on('mouseenter', POINT_LAYER, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', POINT_LAYER, () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('mouseenter', CLUSTER_LAYER, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', CLUSTER_LAYER, () => (this.map.getCanvas().style.cursor = ''));
  }

  async setHydrants(hydrants: Hydrant[]): Promise<void> {
    await this.ready;
    const source = this.map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(hydrants) as any);
  }

  async setUserPosition(lon: number, lat: number): Promise<void> {
    await this.ready;
    const source = this.map.getSource(USER_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }]
    } as any);
  }

  async flyTo(lon: number, lat: number, zoom = 15): Promise<void> {
    await this.ready;
    this.map.flyTo({ center: [lon, lat], zoom, speed: 1.4 });
  }

  getBounds() {
    return this.map.getBounds();
  }
}
