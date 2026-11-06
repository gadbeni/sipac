import { describe, it, expect, vi } from 'vitest';
import { createLocalDataSource, matchWhere } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { createRepository, setLatency } from '@/services/repositories/createRepository';
import { generateRequestCode, CODE_ALPHABET, formatTicketCode, maskName, documentKey } from '@/utils/codes';
import { createRandom } from '@/utils/random';
import { isAppError } from '@/services/errors';

const make = (opts = {}) => {
  const storage = createMemoryStorage();
  let online = true;
  const emit = vi.fn();
  const ds = createLocalDataSource({ storage, online: () => online, emit, ...opts });
  return { ds, storage, emit, setOnline: (v) => (online = v) };
};

describe('fuente de datos local', () => {
  it('persiste por colección y emite cambios', () => {
    const { ds, storage, emit } = make();
    ds.transaction(['centros'], (tx) => tx.insert('centros', { id: 'c1', nombre: 'A' }));
    expect(JSON.parse(storage.getItem('sipac:v1:centros'))[0].nombre).toBe('A');
    expect(emit).toHaveBeenCalledWith(['centros']);
  });

  it('devuelve copias: mutar el resultado no altera los datos', () => {
    const { ds } = make();
    ds.replaceAll({ centros: [{ id: 'c1', nombre: 'A' }] });
    ds.list('centros')[0].nombre = 'X';
    ds.get('centros', 'c1').nombre = 'Y';
    expect(ds.get('centros', 'c1').nombre).toBe('A');
  });

  it('es todo o nada: si la función falla, no se escribe nada', () => {
    const { ds } = make();
    ds.replaceAll({ a: [{ id: '1' }], b: [] });
    expect(() =>
      ds.transaction(['a', 'b'], (tx) => {
        tx.insert('b', { id: 'x' });
        tx.update('a', '1', { v: 1 });
        throw new Error('regla violada');
      }),
    ).toThrow('regla violada');
    expect(ds.list('b')).toEqual([]);
    expect(ds.get('a', '1').v).toBeUndefined();
  });

  it('revierte si falla la escritura de una colección (cuota llena)', () => {
    const storage = createMemoryStorage();
    const ds = createLocalDataSource({ storage, online: () => true, emit: () => {} });
    ds.replaceAll({ a: [{ id: '1' }], b: [{ id: '2' }] });
    const orig = storage.setItem;
    storage.setItem = (k, v) => {
      if (k.endsWith(':b')) {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
      orig(k, v);
    };
    let err;
    try {
      ds.transaction(['a', 'b'], (tx) => {
        tx.update('a', '1', { v: 1 });
        tx.update('b', '2', { v: 2 });
      });
    } catch (e) {
      err = e;
    }
    expect(isAppError(err, 'ALMACENAMIENTO_LLENO')).toBe(true);
    storage.setItem = orig;
    expect(ds.get('a', '1').v).toBeUndefined();
  });

  it('lee el estado fresco del almacenamiento al iniciar una transacción (otra pestaña)', () => {
    const storage = createMemoryStorage();
    const tabA = createLocalDataSource({ storage, online: () => true, emit: () => {} });
    const tabB = createLocalDataSource({ storage, online: () => true, emit: () => {} });
    tabA.replaceAll({ fichas: [] });
    tabA.list('fichas'); // caché de A vacía
    tabB.transaction(['fichas'], (tx) => tx.insert('fichas', { id: 'f1', slot: 1 }));
    const seen = tabA.transaction(['fichas'], (tx) => tx.all('fichas').length);
    expect(seen).toBe(1);
  });

  it('bloquea escrituras sin conexión (RN-OFF-01) pero permite lecturas', () => {
    const { ds, setOnline } = make();
    ds.replaceAll({ centros: [{ id: 'c1' }] });
    setOnline(false);
    expect(ds.list('centros')).toHaveLength(1);
    let err;
    try {
      ds.transaction(['centros'], (tx) => tx.insert('centros', { id: 'c2' }));
    } catch (e) {
      err = e;
    }
    expect(isAppError(err, 'SIN_CONEXION')).toBe(true);
    expect(ds.list('centros')).toHaveLength(1);
    // La siembra local no es una operación "de servidor"
    ds.replaceAll({ centros: [] }, { force: true });
    expect(ds.list('centros')).toHaveLength(0);
  });

  it('rechaza transacciones asíncronas', () => {
    const { ds } = make();
    expect(() => ds.transaction(['a'], async () => {})).toThrow(/síncrona/);
  });

  it('clearAll conserva preferencias fuera del prefijo de datos', () => {
    const { ds, storage } = make();
    storage.setItem('sipac:pref:colorMode', 'dark');
    ds.replaceAll({ centros: [{ id: 'c1' }] });
    ds.setMeta({ schemaVersion: 1 });
    ds.clearAll();
    expect(ds.getMeta()).toBeNull();
    expect(ds.list('centros')).toEqual([]);
    expect(storage.getItem('sipac:pref:colorMode')).toBe('dark');
  });

  it('matchWhere admite valores, listas y predicados', () => {
    const it_ = { a: 1, b: 'x' };
    expect(matchWhere(it_, { a: 1, b: ['x', 'y'], c: undefined })).toBe(true);
    expect(matchWhere(it_, { a: (v) => v > 1 })).toBe(false);
  });
});

describe('repositorio', () => {
  it('lista con filtro, orden y paginación', async () => {
    setLatency(0);
    const { ds } = make();
    ds.replaceAll({
      x: [
        { id: '1', n: 3, c: 'a' },
        { id: '2', n: 1, c: 'a' },
        { id: '3', n: 2, c: 'b' },
      ],
    });
    const repo = createRepository('x', { ds: () => ds });
    expect((await repo.list({ where: { c: 'a' }, sort: 'n' })).map((i) => i.id)).toEqual(['2', '1']);
    expect((await repo.list({ sort: '-n', page: 0, pageSize: 2 })).items.map((i) => i.id)).toEqual([
      '1',
      '3',
    ]);
    const created = await repo.create({ n: 9 });
    expect(created.id).toMatch(/^x_/);
    expect(created.creadoEn).toBeTruthy();
    expect((await repo.update(created.id, { n: 10 })).n).toBe(10);
  });
});

describe('códigos', () => {
  it('código de solicitud sin caracteres ambiguos y único', () => {
    const rng = createRandom(1);
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      const c = generateRequestCode('CSC', rng.next, seen);
      expect(c).toMatch(new RegExp(`^CSC-[${CODE_ALPHABET}]{6}$`));
      expect(seen.has(c)).toBe(false);
      seen.add(c);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it('formatos de ficha, nombre enmascarado y clave de documento', () => {
    expect(formatTicketCode('MG', 7)).toBe('MG-07');
    expect(maskName('María José', 'Pérez Suárez')).toBe('María P***');
    expect(documentKey({ tipoDocumento: 'CI', numeroDocumento: ' 123a ', complemento: null })).toBe(
      'CI|123A|',
    );
  });
});
