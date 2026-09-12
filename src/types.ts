export type StatoIdrante = 'attivo' | 'da_verificare' | 'fuori_servizio' | 'sconosciuto';

export interface Hydrant {
  id: string;
  lon: number;
  lat: number;
  comune: string | null;
  provincia: string | null;
  regione: string | null;
  localita: string | null;
  indirizzo: string | null;
  incrocio: string | null;
  tipologia: string;
  attacco: string;
  stato: StatoIdrante;
  pressione: number | null;
  portata: number | null;
  pertinenza: string | null;
  accesso: string | null;
  canadair: boolean;
  elicottero: boolean;
  pescaggio: boolean;
  note: string | null;
}

/** Modifica locale (offline) fatta da un operatore su un idrante: sovrascrive stato/note. */
export interface HydrantOverride {
  id: string;
  stato?: StatoIdrante;
  note?: string;
  updatedAt: number;
}

export interface HydrantWithDistance extends Hydrant {
  distanceMeters: number;
  bearingDeg: number;
}

export interface UserPosition {
  lon: number;
  lat: number;
  accuracyMeters: number | null;
  headingDeg: number | null;
  timestamp: number;
}

/** Nome da mostrare per un idrante nell'interfaccia: via/localita e comune
 *  (provincia tra parentesi) — mai il codice numerico identificativo. */
export function hydrantDisplayName(h: Pick<Hydrant, 'indirizzo' | 'localita' | 'comune' | 'provincia'>): string {
  const via = h.indirizzo ?? h.localita ?? 'Indirizzo non disponibile';
  const comune = h.comune ? (h.provincia ? `${h.comune} (${h.provincia})` : h.comune) : null;
  return comune ? `${via}, ${comune}` : via;
}

export const STATO_LABEL: Record<StatoIdrante, string> = {
  attivo: 'Attivo / Funzionante',
  da_verificare: 'Pressione ridotta / Da verificare',
  fuori_servizio: 'Fuori servizio / Guasto',
  sconosciuto: 'Stato sconosciuto'
};

export const STATO_COLOR: Record<StatoIdrante, string> = {
  attivo: '#1e8e3e',
  da_verificare: '#f2a900',
  fuori_servizio: '#d32f2f',
  sconosciuto: '#757575'
};
