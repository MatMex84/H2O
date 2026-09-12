import type { HydrantWithDistance } from '../types';
import { formatDistance } from '../geo/distance';

export class NearbyDrawer {
  readonly el: HTMLElement;
  private listEl: HTMLElement;
  private titleEl: HTMLElement;
  private onSelect: (id: string) => void;

  constructor(onSelect: (id: string) => void) {
    this.onSelect = onSelect;
    this.el = document.createElement('div');
    this.el.id = 'nearby-drawer';
    this.el.innerHTML = `
      <div class="drawer-header">
        <span class="drawer-title" data-role="title">Idranti vicini</span>
        <button class="btn-icon ghost" data-action="close" aria-label="Chiudi elenco">✕</button>
      </div>
      <div id="nearby-list"></div>
    `;
    document.body.appendChild(this.el);
    this.listEl = this.el.querySelector('#nearby-list')!;
    this.titleEl = this.el.querySelector('[data-role="title"]')!;
    this.el.querySelector('[data-action="close"]')?.addEventListener('click', () => this.close());
  }

  open(): void {
    this.el.classList.add('open');
  }

  close(): void {
    this.el.classList.remove('open');
  }

  toggle(): void {
    this.el.classList.toggle('open');
  }

  get isOpen(): boolean {
    return this.el.classList.contains('open');
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
  }

  render(items: HydrantWithDistance[]): void {
    if (items.length === 0) {
      this.listEl.innerHTML = `<div class="empty-state">Nessun idrante trovato.</div>`;
      return;
    }
    this.listEl.innerHTML = items
      .map(
        (h) => `
      <button class="hydrant-row" data-id="${h.id}">
        <span class="status-dot ${statusClass(h.stato)}"></span>
        <span class="info">
          <div class="addr">${escapeHtml(h.indirizzo ?? h.localita ?? 'Indirizzo non disponibile')}</div>
          <div class="meta">${escapeHtml(h.comune ? (h.provincia ? `${h.comune} (${h.provincia})` : h.comune) : '—')}</div>
        </span>
        <span class="dist">${Number.isFinite(h.distanceMeters) ? formatDistance(h.distanceMeters) : '—'}</span>
      </button>`
      )
      .join('');

    this.listEl.querySelectorAll<HTMLButtonElement>('.hydrant-row').forEach((row) => {
      row.addEventListener('click', () => {
        this.onSelect(row.dataset.id!);
        this.close();
      });
    });
  }
}

function statusClass(stato: string): string {
  if (stato === 'attivo') return 'ok';
  if (stato === 'da_verificare') return 'warn';
  if (stato === 'fuori_servizio') return 'bad';
  return '';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
