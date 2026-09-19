import { openDB, type IDBPDatabase } from 'idb';
import type { Hydrant, StatoIdrante } from '../types';

const DB_NAME = 'h2o-idranti';
const DB_VERSION = 1;
const STORE_HYDRANTS = 'hydrants';
const STORE_META = 'meta';

/** Bump quando cambia lo schema del dataset sorgente (public/data/idranti.geojson). */
const SEED_VERSION = 'idranti-v2';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_HYDRANTS)) {
          db.createObjectStore(STORE_HYDRANTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      }
    });
  }
  return dbPromise;
}

export type SeedProgress = { loaded: number; total: number; phase: 'download' | 'import' };

/**
 * Il GeoJSON sorgente (public/data/idranti.geojson) usa chiavi corte per
 * contenere il peso del file con 100k+ feature — vedi scripts/convert-data.mjs.
 * Qui vengono riespanse nello schema Hydrant leggibile usato dall'app.
 */
function expandHydrant(p: Record<string, any>, lon: number, lat: number): Hydrant {
  return {
    id: String(p.i),
    lon,
    lat,
    comune: p.c ?? null,
    provincia: p.p ?? null,
    regione: p.r ?? null,
    localita: p.l ?? null,
    indirizzo: p.a ?? null,
    incrocio: p.x ?? null,
    tipologia: p.t ?? 'non_definito',
    attacco: p.k ?? 'Non specificato',
    stato: (p.s ?? 'sconosciuto') as StatoIdrante,
    pressione: p.pr ?? null,
    portata: p.po ?? null,
    pertinenza: p.pt ?? null,
    accesso: p.ac ?? null,
    canadair: p.cn === 1,
    elicottero: p.el === 1,
    pescaggio: p.ps === 1,
    note: p.n ?? null,
    proprietario: p.pv ?? null,
    custodia: p.cu ?? null,
    referente: p.rf ?? null,
    contatto: p.ct ?? null,
    provvedimento: p.pd ?? null,
    diametroTubazioneMm: p.dm ?? null,
    datasetOrigine: p.ds ?? null
  };
}

/**
 * Popola IndexedDB dal GeoJSON locale se non è già stato importato (o se la
 * versione del dataset è cambiata). Idempotente: se già seedato, non rifà nulla.
 */
export async function ensureSeeded(onProgress?: (p: SeedProgress) => void): Promise<number> {
  const db = await getDb();
  const meta = await db.get(STORE_META, 'seedVersion');
  const count = await db.count(STORE_HYDRANTS);
  if (meta?.value === SEED_VERSION && count > 0) {
    return count;
  }

  const res = await fetch(`${import.meta.env.BASE_URL}data/idranti.geojson`);
  if (!res.ok) throw new Error(`Impossibile caricare il dataset locale (${res.status})`);
  const geojson = await res.json();
  const features: any[] = geojson.features ?? [];

  if (meta && count > 0) {
    await db.clear(STORE_HYDRANTS);
  }

  const CHUNK = 2000;
  const tx = db.transaction(STORE_HYDRANTS, 'readwrite');
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const [lon, lat] = f.geometry.coordinates;
    tx.store.put(expandHydrant(f.properties, lon, lat));
    if (onProgress && i % CHUNK === 0) onProgress({ loaded: i, total: features.length, phase: 'import' });
  }
  await tx.done;

  await db.put(STORE_META, { key: 'seedVersion', value: SEED_VERSION });
  onProgress?.({ loaded: features.length, total: features.length, phase: 'import' });
  return features.length;
}

/** Carica tutti gli idranti dal database locale in memoria. */
export async function getAllHydrants(): Promise<Hydrant[]> {
  const db = await getDb();
  return db.getAll(STORE_HYDRANTS);
}

/** Applica un aggiornamento locale (stato operativo e/o nota) a un idrante. */
export async function updateHydrantLocal(
  id: string,
  patch: { stato?: StatoIdrante; note?: string }
): Promise<Hydrant> {
  const db = await getDb();
  const tx = db.transaction(STORE_HYDRANTS, 'readwrite');
  const current: Hydrant | undefined = await tx.store.get(id);
  if (!current) throw new Error(`Idrante ${id} non trovato nel database locale`);
  const updated: Hydrant = { ...current, ...patch };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function getDatasetCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_HYDRANTS);
}
