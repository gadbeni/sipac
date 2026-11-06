/**
 * Lógica pura de DataTable (búsqueda, orden y paginación) para poder probarla sin DOM.
 * Una columna: { field, header, value?(row), searchable?, sortable?, sortValue?(row) }.
 */
import { normalizeText, compareText } from './text';

export const cellValue = (col, row) => (col.value ? col.value(row) : row[col.field]);

export function filterRows(rows, columns, query, getSearchText) {
  const q = normalizeText(query);
  if (!q) return rows;
  const terms = q.split(/\s+/);
  const cols = columns.filter((c) => c.searchable !== false && (c.field || c.value));
  return rows.filter((row) => {
    const hay = normalizeText(
      getSearchText ? getSearchText(row) : cols.map((c) => cellValue(c, row)).join(' '),
    );
    return terms.every((t) => hay.includes(t));
  });
}

export function sortRows(rows, column, direction = 'asc') {
  if (!column) return rows;
  const get = column.sortValue || ((r) => cellValue(column, r));
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // vacíos al final en ambos sentidos
    if (vb == null) return -1;
    const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : compareText(va, vb);
    return r * sign;
  });
}

export function paginate(rows, page, pageSize) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(Math.max(0, page), pages - 1);
  return { page: safe, pages, rows: rows.slice(safe * pageSize, safe * pageSize + pageSize) };
}
