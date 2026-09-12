import type { Hydrant, StatoIdrante } from '../types';
import { STATO_LABEL } from '../types';
import { formatDistance, bearingToCompass } from '../geo/distance';
import { NAV_APPS, defaultNavApp, openNavigation, type NavApp } from '../geo/navigate';

export interface BottomSheetCallbacks {
  onStatusChange: (id: string, stato: StatoIdrante) => Promise<void> | void;
  onSaveNote: (id: string, note: string) => Promise<void> | void;
}

const STATUS_BUTTONS: { stato: StatoIdrante; label: string }[] = [
  { stato: 'attivo', label: 'Attivo' },
  { stato: 'da_verificare', label: 'Da verificare' },
  { stato: 'fuori_servizio', label: 'Fuori servizio' }
];

function fieldHtml(label: string, value: string | null | undefined, full = false): string {
  return `<div class="${full ? 'full' : ''}">
    <div class="field-label">${label}</div>
    <div class="field-value">${value && value.trim() !== '' ? escapeHtml(value) : '—'}</div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export class BottomSheet {
  readonly el: HTMLElement;
  private current: Hydrant | null = null;
  private cb: BottomSheetCallbacks;

  constructor(cb: BottomSheetCallbacks) {
    this.cb = cb;
    this.el = document.createElement('div');
    this.el.id = 'bottomsheet';
    document.body.appendChild(this.el);
  }

  hide(): void {
    this.el.classList.remove('open');
    this.current = null;
  }

  show(hydrant: Hydrant, distanceMeters: number | null, bearingDeg: number | null): void {
    this.current = hydrant;
    const distanceLine = distanceMeters != null
      ? `${formatDistance(distanceMeters)} ${bearingDeg != null ? `· direzione ${bearingToCompass(bearingDeg)}` : ''} in linea d'aria`
      : 'Posizione GPS non disponibile';

    this.el.innerHTML = `
      <button class="sheet-close" data-action="close" aria-label="Chiudi">✕</button>
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <div class="sheet-header">
          <span class="sheet-id">#${escapeHtml(hydrant.id)}</span>
          <span class="badge ${hydrant.stato}">${STATO_LABEL[hydrant.stato]}</span>
        </div>
        <div class="sheet-distance">${distanceLine}</div>

        <button class="btn-navigate" data-action="navigate-default">🧭 Naviga qui</button>
        <div class="nav-app-row">
          ${NAV_APPS.map((a) => `<button class="nav-app-chip" data-action="navigate" data-app="${a.id}">${a.label}</button>`).join('')}
        </div>

        <div class="field-grid">
          ${fieldHtml('Tipologia', formatTipologia(hydrant.tipologia))}
          ${fieldHtml('Attacco', hydrant.attacco)}
          ${fieldHtml('Pressione', hydrant.pressione != null ? `${hydrant.pressione} bar` : null)}
          ${fieldHtml('Portata', hydrant.portata != null ? `${hydrant.portata} l/min` : null)}
          ${fieldHtml('Comune', [hydrant.comune, hydrant.provincia].filter(Boolean).join(' (' ) + (hydrant.provincia ? ')' : ''))}
          ${fieldHtml('Pertinenza', hydrant.pertinenza)}
          ${fieldHtml('Indirizzo', hydrant.indirizzo, true)}
          ${fieldHtml('Note di accesso', hydrant.note, true)}
        </div>

        <div class="section-title">Aggiorna stato (locale, offline)</div>
        <div class="status-edit-row">
          ${STATUS_BUTTONS.map(
            (b) => `<button class="status-edit-btn ${b.stato} ${hydrant.stato === b.stato ? 'selected' : ''}" data-action="set-status" data-stato="${b.stato}">${b.label}</button>`
          ).join('')}
        </div>

        <div class="section-title">Nota operativa</div>
        <textarea id="sheet-note" placeholder="Aggiungi una nota (es. accesso, anomalie riscontrate)…">${escapeHtml(hydrant.note ?? '')}</textarea>
        <button class="btn-secondary" data-action="save-note">Salva nota</button>
      </div>
    `;
    this.el.classList.add('open');
    this.wireActions();
  }

  private wireActions(): void {
    if (!this.current) return;
    const hydrant = this.current;
    const target = { lat: hydrant.lat, lon: hydrant.lon, label: `Idrante ${hydrant.id}` };

    this.el.querySelector('[data-action="close"]')?.addEventListener('click', () => this.hide());

    this.el.querySelector('[data-action="navigate-default"]')?.addEventListener('click', () => {
      openNavigation(defaultNavApp(), target);
    });

    this.el.querySelectorAll<HTMLButtonElement>('[data-action="navigate"]').forEach((btn) => {
      btn.addEventListener('click', () => openNavigation(btn.dataset.app as NavApp, target));
    });

    this.el.querySelectorAll<HTMLButtonElement>('[data-action="set-status"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const stato = btn.dataset.stato as StatoIdrante;
        await this.cb.onStatusChange(hydrant.id, stato);
        hydrant.stato = stato;
        this.show(hydrant, null, null); // ri-renderizza; distanza aggiornata dal chiamante se serve
      });
    });

    this.el.querySelector('[data-action="save-note"]')?.addEventListener('click', async () => {
      const textarea = this.el.querySelector<HTMLTextAreaElement>('#sheet-note');
      await this.cb.onSaveNote(hydrant.id, textarea?.value ?? '');
    });
  }
}

function formatTipologia(t: string): string {
  const map: Record<string, string> = {
    sottosuolo: 'Sottosuolo',
    soprasuolo: 'Soprasuolo / Colonnina',
    parete: 'A parete',
    non_definito: 'Non definito'
  };
  return map[t] ?? t;
}
