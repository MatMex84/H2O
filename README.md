# H2O — Idranti e Risorse Idriche

PWA offline-first per la localizzazione e gestione rapida di idranti e altre
risorse idriche sul territorio. Pensata per operatori sul campo (VVF, squadre
di emergenza, tecnici di rete): mappa ad alto contrasto, pulsanti grandi,
funziona anche senza connessione.

Il dataset incluso è quello reale nazionale **"Approvvigionamenti Idrici
VVF"** (120.238 idranti georeferenziati in tutta Italia, da
`Approvvigionamenti_Idrici_VVF_Idranti.zip`).

## Stack tecnologico

- **Vite + TypeScript** (vanilla, nessun framework UI: bundle piccolo, avvio rapido)
- **MapLibre GL JS** per la mappa (clustering nativo via Supercluster, WebGL)
- **IndexedDB** (via [`idb`](https://github.com/jakearchibald/idb)) come database locale — è il "SQLite del browser"
- **vite-plugin-pwa** (Workbox) per manifest + Service Worker + cache offline
- **pmtiles** per un'eventuale basemap vettoriale 100% offline (opzionale, vedi sotto)

Nessun backend: tutto risiede ed elabora sul dispositivo.

## Avvio rapido

```bash
npm install
npm run convert-data   # genera public/data/idranti.geojson dal .zip sorgente
npm run make-icons     # genera le icone PWA (public/icons/*)
npm run dev            # http://localhost:5173
```

Build di produzione:

```bash
npm run build
npm run preview        # serve dist/ su http://localhost:4173
```

Al primo avvio l'app importa i 120k idranti dal GeoJSON in IndexedDB (qualche
secondo, mostrato con barra di progresso); alle visite successive parte
istantaneamente dal database locale, anche offline.

## Struttura del progetto

```
H2O/
├─ Approvvigionamenti_Idrici_VVF_Idranti.zip   # dataset sorgente originale (CSV)
├─ scripts/
│  ├─ convert-data.mjs      # CSV → public/data/idranti.geojson (normalizzato)
│  └─ make-icons.mjs        # genera le icone PNG del manifest PWA
├─ public/
│  ├─ icons/                # icone PWA generate (192/512/maskable/apple-touch)
│  └─ data/
│     ├─ idranti.geojson    # dataset generato (gitignored, si rigenera)
│     ├─ basemap.pmtiles    # [opzionale] basemap vettoriale offline
│     └─ basemap-style.json # [opzionale] stile MapLibre per la basemap sopra
├─ src/
│  ├─ main.ts               # bootstrap app, orchestrazione stato/eventi
│  ├─ types.ts               # modello dati Hydrant, enum stato, colori
│  ├─ style.css              # tema ad alto contrasto, layout mobile-first
│  ├─ db/db.ts                # IndexedDB: seed, lettura, aggiornamenti locali
│  ├─ map/
│  │  ├─ map.ts               # MapLibre: source/layer, clustering, eventi
│  │  └─ basemapStyle.ts      # risoluzione basemap (pmtiles offline o raster online)
│  ├─ geo/
│  │  ├─ distance.ts          # Haversine, bearing, formattazione distanza/bussola
│  │  ├─ geolocation.ts       # watchPosition/getCurrentPosition + stato GPS
│  │  └─ navigate.ts          # deep link Google/Apple/Waze/OsmAnd/Organic Maps
│  └─ ui/
│     ├─ topbar.ts            # indicatori GPS / connessione / database
│     ├─ bottomsheet.ts       # scheda dettaglio idrante + modifica stato locale
│     ├─ nearbylist.ts        # drawer elenco idranti ordinati per distanza
│     └─ searchbar.ts         # barra inferiore: ricerca + apertura elenco
├─ vite.config.ts            # config PWA (manifest, precache, runtime caching tile)
└─ index.html
```

## Modello dati

Ogni idrante (`src/types.ts`) espone: `id` (codice numerico, l'ex `ObjectID`
del dataset — usato per la ricerca rapida), coordinate, comune/provincia/
regione/località, indirizzo, tipologia (sottosuolo/soprasuolo/parete),
attacco (UNI 70/45/altro), stato operativo, pressione (bar), portata (l/min),
pertinenza, accesso mezzi, idoneità Canadair/elicottero/pescaggio e note.

Il file `public/data/idranti.geojson` usa internamente chiavi corte
(`i`, `c`, `p`, `s`, `pr`, …) per contenere il peso del file con 120k+
feature; `src/db/db.ts` le riespande nello schema leggibile sopra durante
l'importazione in IndexedDB. Per rigenerare il dataset dopo un aggiornamento
del CSV sorgente, esegui di nuovo `npm run convert-data` e incrementa
`SEED_VERSION` in `src/db/db.ts` (forza il re-import sui dispositivi che
avevano già la versione precedente in cache).

**Gestione locale (offline):** dalla scheda dettaglio l'operatore può
correggere stato operativo e nota di accesso di un idrante; la modifica è
scritta subito in IndexedDB e sopravvive a riavvii/offline. Non c'è sync
verso un server: è una scelta esplicita per restare 100% offline-first: se in
futuro serve condividere le modifiche tra dispositivi, il punto di innesto è
`updateHydrantLocal` in `src/db/db.ts`.

## Basemap offline

Di default la mappa usa tile raster OpenStreetMap online, messe in cache dal
Service Worker (`CacheFirst`) man mano che l'operatore naviga: le zone già
visitate restano disponibili anche senza connessione alla visita successiva,
ma la prima visita in una zona nuova richiede rete.

Per una copertura offline **garantita fin dal primo avvio** (consigliato per
uso operativo reale), genera una basemap vettoriale locale in formato
[PMTiles](https://protomaps.com/) per l'area di interesse (es. con
[`tippecanoe`](https://github.com/felt/tippecanoe) + dati
[Protomaps](https://protomaps.com/) o [OpenMapTiles](https://openmaptiles.org/)),
copia i due file in:

```
public/data/basemap.pmtiles
public/data/basemap-style.json   # stile MapLibre che referenzia "pmtiles://data/basemap.pmtiles"
```

L'app li rileva automaticamente all'avvio (`src/map/basemapStyle.ts`) e li
usa al posto delle tile online — nessuna modifica al codice necessaria.

## Ricerca e vicinanza

- **Ricerca** (barra inferiore): filtra per codice idrante, indirizzo,
  località, comune o provincia (case/accent-insensitive), in tempo reale
  mentre si digita.
- **Elenco vicinanza** (icona 📋): idranti ordinati per distanza crescente in
  linea d'aria (formula di Haversine, `src/geo/distance.ts`); richiede il GPS
  attivo, altrimenti mostra l'elenco senza ordinamento con un avviso.
- **Naviga qui**: apre l'app di navigazione predefinita della piattaforma
  (Apple Maps su iOS, selezione di sistema via `geo:` su Android) con un tap;
  in alternativa un selettore rapido apre Google Maps, Waze, OsmAnd o Organic
  Maps (queste ultime due supportano la navigazione turn-by-turn 100%
  offline se l'area è già scaricata in quelle app).

## Installazione come app (PWA)

Su Chrome/Edge (Android/desktop): menu → "Installa app". Su Safari (iOS):
condividi → "Aggiungi alla schermata Home". Una volta installata, l'app si
apre a schermo intero e funziona offline secondo quanto descritto sopra.

> **Nota sui service worker in ambienti di anteprima sandboxati** (es. alcuni
> pannelli di preview integrati): la registrazione del Service Worker può
> fallire per restrizioni dell'ambiente stesso pur essendo il file generato
> corretto. Per verificare realmente il comportamento offline, usa un
> browser reale: DevTools → Application → Service Workers, oppure disattiva
> la connessione dati dopo aver aperto l'app una prima volta.

## Limiti noti / prossimi passi

- Bundle JS ~230 KB gzip (soprattutto MapLibre GL): accettabile per un'app
  installata, ma volendo si può ridurre con `import()` dinamico della mappa.
- Nessuna sincronizzazione multi-dispositivo delle modifiche locali (per
  design, vedi sopra).
- Il dataset copre l'Italia con densità disomogenea (rilevamento
  crowd-sourced dai vari comandi regionali VVF): alcune regioni sono più
  rappresentate di altre.
