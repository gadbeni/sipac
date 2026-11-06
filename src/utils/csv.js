/**
 * CSV para Excel en español: UTF-8 con BOM (tildes correctas), separador `;`, fin de línea CRLF,
 * decimales con coma y fechas DD/MM/YYYY (las da el llamador ya formateadas).
 */
const BOM = '﻿';
const SEP = ';';

/** Valor de una celda: números con coma decimal; texto entre comillas si hace falta. */
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
  let s = String(v);
  // Evita que Excel interprete texto como fórmula (inyección CSV).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Arma el CSV. `sections`: `[{ title?, columns: [{ key, label, value? }], rows }]` o
 * `{ lines: [[...celdas]] }` para filas libres (encabezado del reporte).
 */
export function toCsv(sections) {
  const out = [];
  for (const sec of sections) {
    if (out.length) out.push('');
    if (sec.lines) {
      for (const l of sec.lines) out.push(l.map(csvCell).join(SEP));
      continue;
    }
    if (sec.title) out.push(csvCell(sec.title));
    out.push(sec.columns.map((c) => csvCell(c.label)).join(SEP));
    for (const r of sec.rows)
      out.push(sec.columns.map((c) => csvCell(c.value ? c.value(r) : r[c.key])).join(SEP));
  }
  return BOM + out.join('\r\n') + '\r\n';
}

/** Descarga el texto como archivo .csv. */
export function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
