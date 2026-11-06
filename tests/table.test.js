import { describe, expect, it } from 'vitest';
import { filterRows, paginate, sortRows } from '@/utils/table';
import { normalizeText } from '@/utils/text';

const cols = [
  { field: 'nombre', header: 'Nombre' },
  { field: 'edad', header: 'Edad' },
  { field: 'interno', header: 'Interno', searchable: false },
];
const rows = [
  { id: 1, nombre: 'José Añez', edad: 40, interno: 'zzz' },
  { id: 2, nombre: 'ana vaca', edad: 9, interno: 'x' },
  { id: 3, nombre: 'Álvaro Roca', edad: null, interno: 'y' },
  { id: 4, nombre: 'Beatriz Égüez', edad: 100, interno: 'w' },
];

describe('DataTable — lógica pura', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalizeText('  ÁÉÍÓÚ Ñandú ')).toBe('aeiou nandu');
  });

  it('busca sin tildes, por varias palabras y solo en columnas buscables', () => {
    expect(filterRows(rows, cols, 'jose').map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, cols, 'EGUEZ beatriz').map((r) => r.id)).toEqual([4]);
    expect(filterRows(rows, cols, 'zzz')).toEqual([]);
    expect(filterRows(rows, cols, '   ')).toBe(rows);
  });

  it('ordena texto en español y números; vacíos al final', () => {
    expect(sortRows(rows, cols[0]).map((r) => r.id)).toEqual([3, 2, 4, 1]);
    expect(sortRows(rows, cols[1]).map((r) => r.id)).toEqual([2, 1, 4, 3]);
    expect(sortRows(rows, cols[1], 'desc').map((r) => r.id)).toEqual([4, 1, 2, 3]);
  });

  it('pagina y corrige una página fuera de rango', () => {
    const p = paginate(rows, 5, 3);
    expect(p.page).toBe(1);
    expect(p.pages).toBe(2);
    expect(p.rows.map((r) => r.id)).toEqual([4]);
    expect(paginate([], 0, 10)).toMatchObject({ page: 0, pages: 1, rows: [] });
  });
});
