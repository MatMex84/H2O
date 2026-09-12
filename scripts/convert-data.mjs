// Converte il dataset sorgente CSV (Approvvigionamenti Idrici VVF) in un
// GeoJSON normalizzato pronto per essere caricato offline dalla PWA.
//
// Input:  Approvvigionamenti_Idrici_VVF_Idranti.zip (nella root del progetto)
// Output: public/data/idranti.geojson
//
// Uso: npm run convert-data
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ZIP_PATH = path.join(ROOT, 'Approvvigionamenti_Idrici_VVF_Idranti.zip');
const EXTRACT_DIR = path.join(ROOT, '_data_src');
const OUT_PATH = path.join(ROOT, 'public', 'data', 'idranti.geojson');

function ensureExtracted() {
  if (fs.existsSync(EXTRACT_DIR)) return;
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  console.log('Estrazione archivio dati sorgente...');
  // unzip è disponibile sia in Git Bash/WSL che tramite tar su Windows 10+/11.
  try {
    execFileSync('tar', ['-xf', ZIP_PATH, '-C', EXTRACT_DIR], { stdio: 'inherit' });
  } catch {
    execFileSync('unzip', ['-o', ZIP_PATH, '-d', EXTRACT_DIR], { stdio: 'inherit' });
  }
}

function findCsv(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const found = findCsv(full);
      if (found) return found;
    } else if (e.name.toLowerCase().endsWith('.csv')) {
      return full;
    }
  }
  return null;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toNumberOrNull(raw) {
  if (raw == null) return null;
  const v = String(raw).trim().replace(',', '.');
  if (v === '') return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'si' || v === 'sì' || v === 'yes' || v === 'true' || v === '1';
}

function normalizeStato(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'si' || v === 'sì' || v === 'idrante funzionante') return 'attivo';
  if (v === 'da_verificare' || v === 'da verificare') return 'da_verificare';
  if (v === 'no') return 'fuori_servizio';
  return 'sconosciuto';
}

function normalizeTipologia(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v || v === '-') return 'non_definito';
  if (v.includes('sottosuolo')) return 'sottosuolo';
  if (v.includes('colonn') || v.includes('soprasuolo')) return 'soprasuolo';
  if (v.includes('parete')) return 'parete';
  return 'non_definito';
}

const ATTACCO_MAP = {
  sezione_70: 'UNI 70',
  '70': 'UNI 70',
  sezione_45: 'UNI 45',
  'sezione_70/45': 'UNI 70/45',
  'sezione_70/100': 'UNI 70/100',
  sezione_70_attacco_baionetta: 'UNI 70 a baionetta',
  sezione_45_attacco_baionetta: 'UNI 45 a baionetta',
  storz: 'Storz',
  bss: 'BSS'
};

function normalizeAttacco(raw, specificare) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (ATTACCO_MAP[key]) return ATTACCO_MAP[key];
  if (key === 'altro_attacco_non_codificato') {
    const spec = String(specificare ?? '').trim();
    return spec || 'Altro';
  }
  return 'Non specificato';
}

function cleanStr(raw) {
  const v = String(raw ?? '').trim();
  return v === '' || v === '-' ? null : v;
}

async function main() {
  if (!fs.existsSync(ZIP_PATH)) {
    console.error(`File sorgente non trovato: ${ZIP_PATH}`);
    process.exit(1);
  }
  ensureExtracted();
  const csvPath = findCsv(EXTRACT_DIR);
  if (!csvPath) {
    console.error('Nessun file CSV trovato nell\'archivio estratto.');
    process.exit(1);
  }
  console.log('Lettura CSV:', csvPath);

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  let header = null;
  let idx = {};
  let total = 0;
  let kept = 0;
  let skippedCoords = 0;
  const features = [];

  const col = (vals, name) => vals[idx[name]];

  for await (const rawLine of rl) {
    if (rawLine === '') continue;
    if (!header) {
      header = parseCsvLine(rawLine.replace(/^﻿/, ''));
      header.forEach((h, i) => { idx[h.trim()] = i; });
      continue;
    }
    total++;
    const vals = parseCsvLine(rawLine);

    const lon = toNumberOrNull(col(vals, 'x'));
    const lat = toNumberOrNull(col(vals, 'y'));
    if (lon == null || lat == null || lon < 5 || lon > 20 || lat < 34 || lat > 48) {
      skippedCoords++;
      continue;
    }

    // Codice idrante mostrato/ricercato in app: ObjectID numerico, molto più
    // pratico sul campo di un GlobalID (UUID). Il GlobalID non viene esportato.
    const id = cleanStr(col(vals, 'ObjectID')) ?? String(total);
    const via = cleanStr(col(vals, 'Indirizzo - Via'));
    const civico = cleanStr(col(vals, 'n° civico'));
    const indirizzo = via ? (civico ? `${via}, ${civico}` : via) : null;
    const ostacolo = cleanStr(col(vals, 'specificare il tipo di ostacolo'));
    const noteRaw = cleanStr(col(vals, 'Note'));
    const note = [noteRaw, ostacolo ? `Ostacoli: ${ostacolo}` : null].filter(Boolean).join(' — ') || null;

    const stato = normalizeStato(col(vals, 'FUNZIONANTE?'));
    const tipologia = normalizeTipologia(col(vals, 'Tipologia Risorsa'));

    // Chiavi corte per contenere il peso del GeoJSON (100k+ feature); vengono
    // riespanse ai nomi leggibili in src/db/db.ts durante l'import in IndexedDB.
    const props = {};
    props.i = id;
    if (cleanStr(col(vals, 'Denominazione Comune'))) props.c = cleanStr(col(vals, 'Denominazione Comune'));
    if (cleanStr(col(vals, 'Denominazione Provincia'))) props.p = cleanStr(col(vals, 'Denominazione Provincia'));
    if (cleanStr(col(vals, 'Denominazione Regione'))) props.r = cleanStr(col(vals, 'Denominazione Regione'));
    if (cleanStr(col(vals, 'Località'))) props.l = cleanStr(col(vals, 'Località'));
    if (indirizzo) props.a = indirizzo;
    if (cleanStr(col(vals, 'Incrocio - Via'))) props.x = cleanStr(col(vals, 'Incrocio - Via'));
    if (tipologia !== 'non_definito') props.t = tipologia;
    props.k = normalizeAttacco(col(vals, 'Attacco Idrante'), col(vals, 'specificare il tipo di attacco'));
    if (stato !== 'sconosciuto') props.s = stato;
    const pressione = toNumberOrNull(col(vals, 'Pressione (bar)'));
    if (pressione != null) props.pr = pressione;
    const portata = toNumberOrNull(col(vals, 'Portata (l/m)'));
    if (portata != null) props.po = portata;
    if (cleanStr(col(vals, 'Pertinenza'))) props.pt = cleanStr(col(vals, 'Pertinenza'));
    if (cleanStr(col(vals, 'Accessibilità mezzi terrestri'))) props.ac = cleanStr(col(vals, 'Accessibilità mezzi terrestri'));
    if (toBool(col(vals, 'Canadair'))) props.cn = 1;
    if (toBool(col(vals, 'Elicottero'))) props.el = 1;
    if (toBool(col(vals, 'Pescaggio'))) props.ps = 1;
    if (note) props.n = note;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] },
      properties: props
    });
    kept++;
  }

  const fc = { type: 'FeatureCollection', features };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(fc));

  const sizeMb = (fs.statSync(OUT_PATH).size / (1024 * 1024)).toFixed(1);
  console.log(`Righe totali: ${total}`);
  console.log(`Scartate per coordinate mancanti/non valide: ${skippedCoords}`);
  console.log(`Idranti scritti: ${kept}`);
  console.log(`Output: ${OUT_PATH} (${sizeMb} MB)`);
}

main();
