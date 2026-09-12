import type { GpsStatus } from '../geo/geolocation';

const GPS_LABEL: Record<GpsStatus, string> = {
  idle: 'GPS',
  locating: 'Ricerca GPS…',
  active: 'GPS attivo',
  denied: 'GPS negato',
  unavailable: 'GPS assente'
};

export class Topbar {
  readonly el: HTMLElement;
  private gpsDot: HTMLElement;
  private gpsLabel: HTMLElement;
  private connDot: HTMLElement;
  private connLabel: HTMLElement;
  private dbDot: HTMLElement;
  private dbLabel: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'topbar';
    this.el.innerHTML = `
      <span class="brand">💧 H2O</span>
      <span class="status-pill" data-role="gps"><span class="status-dot pulse"></span><span data-role="gps-label"></span></span>
      <span class="status-pill" data-role="conn"><span class="status-dot"></span><span data-role="conn-label"></span></span>
      <span class="status-pill" data-role="db"><span class="status-dot"></span><span data-role="db-label"></span></span>
    `;
    this.gpsDot = this.el.querySelector('[data-role="gps"] .status-dot')!;
    this.gpsLabel = this.el.querySelector('[data-role="gps-label"]')!;
    this.connDot = this.el.querySelector('[data-role="conn"] .status-dot')!;
    this.connLabel = this.el.querySelector('[data-role="conn-label"]')!;
    this.dbDot = this.el.querySelector('[data-role="db"] .status-dot')!;
    this.dbLabel = this.el.querySelector('[data-role="db-label"]')!;

    this.setOnline(navigator.onLine);
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  }

  setGpsStatus(status: GpsStatus): void {
    this.gpsLabel.textContent = GPS_LABEL[status];
    this.gpsDot.classList.remove('ok', 'warn', 'bad', 'pulse');
    if (status === 'active') this.gpsDot.classList.add('ok');
    else if (status === 'locating' || status === 'idle') this.gpsDot.classList.add('warn', 'pulse');
    else this.gpsDot.classList.add('bad');
  }

  setOnline(online: boolean): void {
    this.connLabel.textContent = online ? 'Online' : 'Offline';
    this.connDot.classList.remove('ok', 'bad');
    this.connDot.classList.add(online ? 'ok' : 'bad');
  }

  setDbStatus(text: string, ready: boolean): void {
    this.dbLabel.textContent = text;
    this.dbDot.classList.remove('ok', 'warn', 'bad', 'pulse');
    this.dbDot.classList.add(ready ? 'ok' : 'warn');
    if (!ready) this.dbDot.classList.add('pulse');
  }
}
