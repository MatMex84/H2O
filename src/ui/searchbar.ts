export interface BottombarCallbacks {
  onSearch: (query: string) => void;
  onToggleList: () => void;
}

export class Bottombar {
  readonly el: HTMLElement;
  private input: HTMLInputElement;

  constructor(cb: BottombarCallbacks) {
    this.el = document.createElement('div');
    this.el.id = 'bottombar';
    this.el.innerHTML = `
      <button class="btn-icon ghost" data-action="list" aria-label="Elenco idranti vicini">📋</button>
      <input id="search-input" type="search" inputmode="search" placeholder="Cerca per codice idrante o indirizzo…" aria-label="Cerca idrante" />
      <button class="btn-icon" data-action="search" aria-label="Cerca">🔎</button>
    `;
    this.input = this.el.querySelector('#search-input')!;

    this.el.querySelector('[data-action="list"]')?.addEventListener('click', () => cb.onToggleList());
    this.el.querySelector('[data-action="search"]')?.addEventListener('click', () => cb.onSearch(this.input.value.trim()));
    this.input.addEventListener('input', () => cb.onSearch(this.input.value.trim()));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
        cb.onSearch(this.input.value.trim());
      }
    });
  }

  get value(): string {
    return this.input.value.trim();
  }

  clear(): void {
    this.input.value = '';
  }
}
