import { normalize } from '../utils/text';

/** Riferimento geografico di un comune italiano: nome, provincia/regione e centroide.
 *  Usato solo come fallback quando una ricerca per comune non trova idranti in
 *  database, per poter comunque spostare la mappa lì e mostrare un report di
 *  prossimità. Dataset offline (public/data/comuni.json), coerente con
 *  l'impostazione offline-first dell'app. */
export interface ComuneRef {
  n: string; // nome
  p: string | null; // sigla provincia
  r: string | null; // regione
  lon: number;
  lat: number;
}

let cache: ComuneRef[] | null = null;
let loadPromise: Promise<ComuneRef[]> | null = null;

async function loadComuni(): Promise<ComuneRef[]> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = fetch(`${import.meta.env.BASE_URL}data/comuni.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Impossibile caricare l'elenco comuni (${res.status})`);
        return res.json();
      })
      .then((data: ComuneRef[]) => {
        cache = data;
        return data;
      })
      .catch((err) => {
        loadPromise = null; // permette un nuovo tentativo alla prossima ricerca
        throw err;
      });
  }
  return loadPromise;
}

/**
 * Cerca un comune per nome (case/accent-insensitive). Ritorna il primo
 * riscontro esatto sul nome normalizzato; se non c'è, il primo riscontro
 * "il nome del comune inizia con la query"; altrimenti null. In caso di
 * comuni omonimi in province diverse ritorna semplicemente il primo trovato:
 * è un'approssimazione accettabile per un semplice "spostati lì".
 */
export async function findComune(query: string): Promise<ComuneRef | null> {
  const q = normalize(query.trim());
  if (q === '') return null;

  let list: ComuneRef[];
  try {
    list = await loadComuni();
  } catch (err) {
    console.warn('Ricerca comune non disponibile:', err);
    return null;
  }

  const exact = list.find((c) => normalize(c.n) === q);
  if (exact) return exact;

  const startsWith = list.find((c) => normalize(c.n).startsWith(q));
  if (startsWith) return startsWith;

  return null;
}
