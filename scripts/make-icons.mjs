// Genera le icone PNG per il manifest PWA (pure JS via pngjs, nessuna
// dipendenza nativa tipo canvas/sharp). Disegna un semplice idrante
// stilizzato (corpo + due prese laterali + cappello) su sfondo pieno.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BG = [11, 61, 92]; // #0b3d5c
const FG = [255, 255, 255];
const ACCENT = [46, 204, 113]; // verde "attivo"

function drawHydrant(png, size, { padding = 0, fg = FG }) {
  const cx = size / 2;
  const usable = size - padding * 2;
  const s = usable / 100; // scala rispetto a una griglia 100x100

  function setPx(x, y, color, alpha = 1) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const idx = (size * y + x) << 2;
    if (alpha >= 1) {
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = 255;
    } else {
      const inv = 1 - alpha;
      png.data[idx] = png.data[idx] * inv + color[0] * alpha;
      png.data[idx + 1] = png.data[idx + 1] * inv + color[1] * alpha;
      png.data[idx + 2] = png.data[idx + 2] * inv + color[2] * alpha;
      png.data[idx + 3] = 255;
    }
  }

  function fillRoundRect(x0, y0, x1, y1, r, color) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const inRect =
          x >= x0 + r && x <= x1 - r ? y >= y0 && y <= y1 :
          y >= y0 + r && y <= y1 - r ? x >= x0 && x <= x1 :
          false;
        let inCorner = false;
        if (!inRect) {
          const corners = [
            [x0 + r, y0 + r], [x1 - r, y0 + r], [x0 + r, y1 - r], [x1 - r, y1 - r]
          ];
          for (const [ccx, ccy] of corners) {
            if ((x - ccx) ** 2 + (y - ccy) ** 2 <= r * r) { inCorner = true; break; }
          }
        }
        if (inRect || inCorner) setPx(x, y, color);
      }
    }
  }

  function fillCircle(x0, y0, r, color) {
    for (let y = Math.floor(y0 - r); y <= Math.ceil(y0 + r); y++) {
      for (let x = Math.floor(x0 - r); x <= Math.ceil(x0 + r); x++) {
        if ((x - x0) ** 2 + (y - y0) ** 2 <= r * r) setPx(x, y, color);
      }
    }
  }

  const toPx = (v) => padding + v * s;

  // Base
  fillRoundRect(toPx(38), toPx(82), toPx(62), toPx(92), 3 * s, color(fg, 0.9));
  // Corpo principale
  fillRoundRect(toPx(35), toPx(38), toPx(65), toPx(84), 6 * s, fg);
  // Prese laterali (bocchettoni)
  fillCircle(toPx(30), toPx(52), 7 * s, fg);
  fillCircle(toPx(70), toPx(52), 7 * s, fg);
  // Collo
  fillRoundRect(toPx(42), toPx(24), toPx(58), toPx(40), 4 * s, fg);
  // Cappello (bullone superiore)
  fillRoundRect(toPx(38), toPx(12), toPx(62), toPx(26), 5 * s, fg);
  fillCircle(toPx(50), toPx(12), 4.5 * s, fg);

  function color(base, alpha) {
    return base; // alpha gestito dal chiamante via setPx se serve; qui restiamo opachi
  }
}

function makeIcon(size, { maskablePadding = 0, bg = BG } = {}) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = bg[0];
      png.data[idx + 1] = bg[1];
      png.data[idx + 2] = bg[2];
      png.data[idx + 3] = 255;
    }
  }
  drawHydrant(png, size, { padding: maskablePadding });
  return png;
}

function writePng(png, filename) {
  const out = path.join(OUT_DIR, filename);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(out, buffer);
  console.log('Creata icona:', out);
}

writePng(makeIcon(192), 'icon-192.png');
writePng(makeIcon(512), 'icon-512.png');
// Maskable: padding extra (~20%) così il contenuto resta nella safe-zone circolare.
writePng(makeIcon(512, { maskablePadding: 90 }), 'icon-maskable-512.png');
writePng(makeIcon(180), 'apple-touch-icon.png');

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="#0b3d5c"/>
  <rect x="35" y="38" width="30" height="46" rx="6" fill="#ffffff"/>
  <circle cx="30" cy="52" r="7" fill="#ffffff"/>
  <circle cx="70" cy="52" r="7" fill="#ffffff"/>
  <rect x="42" y="24" width="16" height="16" rx="4" fill="#ffffff"/>
  <rect x="38" y="12" width="24" height="14" rx="5" fill="#ffffff"/>
  <circle cx="50" cy="12" r="4.5" fill="#ffffff"/>
</svg>`;
fs.writeFileSync(path.join(OUT_DIR, 'favicon.svg'), favicon);
console.log('Creata icona: favicon.svg');
