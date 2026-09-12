import './style.css';
import type { Hydrant, HydrantWithDistance, StatoIdrante, UserPosition } from './types';
import { ensureSeeded, getAllHydrants, updateHydrantLocal, getDatasetCount } from './db/db';
import { HydrantMap } from './map/map';
import { watchPosition, type GpsStatus } from './geo/geolocation';
import { haversineMeters, bearingDeg } from './geo/distance';
import { Topbar } from './ui/topbar';
import { BottomSheet } from './ui/bottomsheet';
import { NearbyDrawer } from './ui/nearbylist';
import { Bottombar } from './ui/searchbar';

const NEARBY_LIMIT = 60;

const app = document.getElementById('app')!;

// ---------- Layout base ----------
const topbar = new Topbar();

const mapContainer = document.createElement('div');
mapContainer.id = 'map-container';
mapContainer.innerHTML = `
  <div id="map"></div>
  <div class="fab-stack">
    <button class="fab primary" id="fab-locate" aria-label="Centra sulla mia posizione">📍</button>
  </div>
  <div class="map-loading" id="loading-overlay">
    <strong id="loading-text">Caricamento database idranti…</strong>
    <div class="progress-track"><div class="progress-fill" id="loading-progress"></div></div>
    <span id="loading-sub" style="color: var(--color-text-muted); font-size: 13px;"></span>
  </div>
`;

app.append(topbar.el, mapContainer);

const bottombar = new Bottombar({
  onSearch: (q) => handleSearch(q),
  onToggleList: () => toggleList()
});
app.append(bottombar.el);

// ---------- Stato applicativo ----------
let hydrants: Hydrant[] = [];
let hydrantsById = new Map<string, Hydrant>();
let userPosition: UserPosition | null = null;
let hasCenteredOnUser = false;

// Assegnata da main() dopo HydrantMap.create(): lo stile della basemap va
// risolto (fetch/HEAD) prima di costruire la mappa, per evitare un secondo
// setStyle() a runtime e le relative race condition sugli eventi 'load'.
let map: HydrantMap;

const nearbyDrawer = new NearbyDrawer((id) => selectHydrant(id, { flyTo: true, closeDrawer: true }));

const bottomSheet = new BottomSheet({
  onStatusChange: async (id, stato) => {
    await updateHydrantLocal(id, { stato });
    const h = hydrantsById.get(id);
    if (h) h.stato = stato;
    await map.setHydrants(hydrants);
    refreshListIfOpen();
  },
  onSaveNote: async (id, note) => {
    await updateHydrantLocal(id, { note });
    const h = hydrantsById.get(id);
    if (h) h.note = note;
  }
});

// ---------- Caricamento dati (offline-first) ----------
async function boot(): Promise<void> {
  const overlay = document.getElementById('loading-overlay')!;
  const progressFill = document.getElementById('loading-progress')!;
  const loadingSub = document.getElementById('loading-sub')!;

  try {
    const count = await getDatasetCount();
    if (count === 0) {
      loadingSub.textContent = 'Prima apertura: import del dataset locale in corso…';
    }
    await ensureSeeded(({ loaded, total }) => {
      const pct = total ? Math.round((loaded / total) * 100) : 0;
      progressFill.style.width = `${pct}%`;
      loadingSub.textContent = `${loaded.toLocaleString('it-IT')} / ${total.toLocaleString('it-IT')} idranti importati`;
    });

    hydrants = await getAllHydrants();
    hydrantsById = new Map(hydrants.map((h) => [h.id, h]));

    topbar.setDbStatus(`${hydrants.length.toLocaleString('it-IT')} idranti (locale)`, true);
    await map.setHydrants(hydrants);
    overlay.remove();
  } catch (err) {
    console.error(err);
    overlay.innerHTML = `<strong>⚠️ Errore nel caricamento dei dati</strong>
      <span style="color: var(--color-text-muted); font-size: 13.5px; max-width: 320px;">
        ${(err as Error).message ?? 'Verifica che il file public/data/idranti.geojson sia presente.'}
      </span>`;
    overlay.classList.add('map-error');
  }
}

// ---------- Geolocalizzazione ----------
watchPosition(
  (pos) => {
    userPosition = pos;
    if (!map) return; // fix GPS arrivato prima che la mappa (async) sia pronta
    map.setUserPosition(pos.lon, pos.lat);
    if (!hasCenteredOnUser) {
      hasCenteredOnUser = true;
      map.flyTo(pos.lon, pos.lat, 15);
    }
    refreshListIfOpen();
  },
  (status: GpsStatus) => topbar.setGpsStatus(status)
);

document.getElementById('fab-locate')!.addEventListener('click', () => {
  if (map && userPosition) {
    map.flyTo(userPosition.lon, userPosition.lat, 16);
  }
});

// ---------- Ricerca & elenco vicinanza ----------
function withDistance(list: Hydrant[]): HydrantWithDistance[] {
  if (!userPosition) {
    return list.map((h) => ({ ...h, distanceMeters: Infinity, bearingDeg: 0 }));
  }
  const { lon, lat } = userPosition;
  return list.map((h) => ({
    ...h,
    distanceMeters: haversineMeters(lon, lat, h.lon, h.lat),
    bearingDeg: bearingDeg(lon, lat, h.lon, h.lat)
  }));
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function handleSearch(query: string): void {
  if (query === '') {
    if (nearbyDrawer.isOpen) renderNearby();
    return;
  }
  const q = normalize(query);
  const matches = hydrants.filter((h) => {
    if (normalize(h.id).includes(q)) return true;
    if (h.indirizzo && normalize(h.indirizzo).includes(q)) return true;
    if (h.localita && normalize(h.localita).includes(q)) return true;
    if (h.comune && normalize(h.comune).includes(q)) return true;
    if (h.provincia && normalize(h.provincia).includes(q)) return true;
    return false;
  });
  const withDist = withDistance(matches)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, NEARBY_LIMIT);
  nearbyDrawer.setTitle(`Risultati per "${query}" (${matches.length})`);
  nearbyDrawer.render(withDist);
  nearbyDrawer.open();
}

function renderNearby(): void {
  if (!userPosition) {
    nearbyDrawer.setTitle('Idranti (attiva il GPS per ordinare per vicinanza)');
    nearbyDrawer.render(withDistance(hydrants.slice(0, NEARBY_LIMIT)));
    return;
  }
  const nearest = withDistance(hydrants)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, NEARBY_LIMIT);
  nearbyDrawer.setTitle('Idranti più vicini');
  nearbyDrawer.render(nearest);
}

function refreshListIfOpen(): void {
  if (nearbyDrawer.isOpen && bottombar.value === '') renderNearby();
}

function toggleList(): void {
  if (nearbyDrawer.isOpen) {
    nearbyDrawer.close();
    return;
  }
  if (bottombar.value !== '') {
    handleSearch(bottombar.value);
  } else {
    renderNearby();
  }
  nearbyDrawer.open();
}

// ---------- Selezione idrante ----------
function selectHydrant(id: string, opts: { flyTo: boolean; closeDrawer?: boolean }): void {
  const h = hydrantsById.get(id);
  if (!h) return;
  const distanceMeters = userPosition ? haversineMeters(userPosition.lon, userPosition.lat, h.lon, h.lat) : null;
  const bearing = userPosition ? bearingDeg(userPosition.lon, userPosition.lat, h.lon, h.lat) : null;
  bottomSheet.show(h, distanceMeters, bearing);
  if (opts.flyTo) map.flyTo(h.lon, h.lat, 17);
  if (opts.closeDrawer) nearbyDrawer.close();
}

async function main(): Promise<void> {
  map = await HydrantMap.create({
    container: document.getElementById('map')!,
    onSelectHydrant: (id) => selectHydrant(id, { flyTo: false })
  });
  await boot();
}

main();
