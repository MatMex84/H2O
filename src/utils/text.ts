/** Normalizza una stringa per confronti case/accent-insensitive (minuscolo, senza diacritici). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
