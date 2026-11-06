/** Normaliza texto para búsquedas: minúsculas y sin tildes ("José" ≈ "jose"). */
export const normalizeText = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
export const compareText = (a, b) => collator.compare(String(a ?? ''), String(b ?? ''));
