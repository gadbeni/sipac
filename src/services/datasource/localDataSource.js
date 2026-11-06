/**
 * Fuente de datos local: LocalStorage (o memoria) con una clave por colección.
 *
 *  - Lecturas desde caché en memoria; la caché de una colección se invalida cuando otra
 *    pestaña la modifica (evento `storage`).
 *  - Escrituras sólo mediante `transaction`, que relee el estado actual del almacenamiento
 *    (no la caché), ejecuta la función sobre copias y persiste todo o nada.
 *  - Sin conexión, toda escritura lanza AppError('SIN_CONEXION') (RN-OFF-01).
 *    La siembra inicial usa `replaceAll({ force: true })` porque no es una operación "de servidor".
 */
import { AppError } from '../errors';
import { emitDataChanged, bindStorageEvents } from './events';
import { isOnline } from './connectivity';
import { storageKeys } from './storage';
import { generateId } from '@/utils/codes';
import { nowIso } from '@/utils/dates';

const clone = (v) =>
  typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));

/** Coincidencia simple: valores escalares (===), arrays (incluye) o funciones predicado. */
export function matchWhere(item, where) {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const v = item[k];
    if (typeof cond === 'function') {
      if (!cond(v, item)) return false;
    } else if (Array.isArray(cond)) {
      if (!cond.includes(v)) return false;
    } else if (v !== cond) return false;
  }
  return true;
}

export function createLocalDataSource({
  storage,
  prefix = 'sipac:v1:',
  metaKey = 'sipac:meta',
  online = isOnline,
  emit = emitDataChanged,
} = {}) {
  if (!storage) throw new Error('createLocalDataSource: storage requerido');
  const cache = new Map();
  const keyOf = (c) => prefix + c;

  const parse = (raw, c) => {
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      console.error(`[datasource] colección corrupta: ${c}`);
      return [];
    }
  };

  /** Referencia interna (sin copiar). No exponer a componentes. */
  const ref = (c) => {
    if (!cache.has(c)) cache.set(c, parse(storage.getItem(keyOf(c)), c));
    return cache.get(c);
  };

  const fresh = (c) => {
    const arr = parse(storage.getItem(keyOf(c)), c);
    cache.set(c, arr);
    return arr;
  };

  const persist = (c, arr) => {
    try {
      storage.setItem(keyOf(c), JSON.stringify(arr));
    } catch (e) {
      if (e?.name === 'QuotaExceededError' || /quota/i.test(String(e?.message))) {
        throw new AppError('ALMACENAMIENTO_LLENO');
      }
      throw e;
    }
    cache.set(c, arr);
  };

  const assertWritable = () => {
    if (!online()) throw new AppError('SIN_CONEXION');
  };

  const ds = {
    kind: 'local',

    /** Copia de todos los registros (o de los que cumplen `where`). */
    list(c, where) {
      const arr = ref(c);
      return clone(where ? arr.filter((it) => matchWhere(it, where)) : arr);
    },

    get(c, id) {
      const found = ref(c).find((it) => it.id === id);
      return found ? clone(found) : null;
    },

    /** Lectura sin copia para cálculos internos de servicios/reglas (no mutar). */
    snapshot(collections) {
      const out = {};
      for (const c of collections) out[c] = ref(c);
      return out;
    },

    /**
     * Ejecuta `fn(tx)` sobre copias frescas de las colecciones indicadas y persiste el resultado.
     * `fn` debe ser síncrona: así la validación y la escritura ocurren en el mismo ciclo y
     * ninguna otra pestaña puede intercalar escrituras (ARCHITECTURE §2.3, R2).
     */
    transaction(collections, fn, { force = false } = {}) {
      if (!force) assertWritable();
      const working = {};
      const before = {};
      for (const c of collections) {
        before[c] = storage.getItem(keyOf(c));
        working[c] = clone(fresh(c));
      }
      const dirty = new Set();
      const stamp = nowIso();
      const need = (c) => {
        if (!(c in working)) throw new Error(`transaction: colección no declarada "${c}"`);
        return working[c];
      };
      const tx = {
        now: stamp,
        all: (c) => need(c),
        find: (c, pred) =>
          need(c).find(typeof pred === 'function' ? pred : (it) => matchWhere(it, pred)) || null,
        filter: (c, pred) => need(c).filter(typeof pred === 'function' ? pred : (it) => matchWhere(it, pred)),
        get: (c, id) => need(c).find((it) => it.id === id) || null,
        insert(c, data, idPrefix) {
          const item = {
            ...data,
            id: data.id || generateId(idPrefix || c.slice(0, 3)),
            creadoEn: data.creadoEn || stamp,
            actualizadoEn: data.actualizadoEn || stamp,
          };
          if (need(c).some((it) => it.id === item.id))
            throw new AppError('DUPLICADO', `ID duplicado: ${item.id}`);
          need(c).push(item);
          dirty.add(c);
          return item;
        },
        update(c, id, patch) {
          const arr = need(c);
          const i = arr.findIndex((it) => it.id === id);
          if (i < 0) throw new AppError('NO_ENCONTRADO', `No existe ${c}/${id}`);
          arr[i] = {
            ...arr[i],
            ...(typeof patch === 'function' ? patch(arr[i]) : patch),
            actualizadoEn: stamp,
          };
          dirty.add(c);
          return arr[i];
        },
        remove(c, id) {
          const arr = need(c);
          const i = arr.findIndex((it) => it.id === id);
          if (i >= 0) {
            arr.splice(i, 1);
            dirty.add(c);
          }
        },
        replace(c, arr) {
          need(c);
          working[c] = arr;
          dirty.add(c);
        },
      };

      const result = fn(tx);
      if (result && typeof result.then === 'function') {
        throw new Error('transaction: la función debe ser síncrona');
      }
      const written = [];
      try {
        for (const c of dirty) {
          persist(c, working[c]);
          written.push(c);
        }
      } catch (e) {
        // Reversión: restaura lo escrito antes del fallo.
        for (const c of written) {
          if (before[c] === null) storage.removeItem(keyOf(c));
          else storage.setItem(keyOf(c), before[c]);
          cache.delete(c);
        }
        throw e;
      }
      if (dirty.size) emit([...dirty]);
      return result;
    },

    /** Reemplaza colecciones completas (siembra / restauración). */
    replaceAll(dataByCollection, { force = false } = {}) {
      return ds.transaction(
        Object.keys(dataByCollection),
        (tx) => {
          for (const [c, arr] of Object.entries(dataByCollection)) tx.replace(c, arr);
        },
        { force },
      );
    },

    getMeta() {
      try {
        return JSON.parse(storage.getItem(metaKey) || 'null');
      } catch {
        return null;
      }
    },

    setMeta(meta) {
      storage.setItem(metaKey, JSON.stringify(meta));
    },

    /** Elimina todas las colecciones y metadatos (conserva preferencias). */
    clearAll() {
      for (const k of storageKeys(storage)) if (k.startsWith(prefix)) storage.removeItem(k);
      storage.removeItem(metaKey);
      cache.clear();
    },

    invalidate(c) {
      if (c) cache.delete(c);
      else cache.clear();
    },

    /**
     * Uso del almacenamiento. Los navegadores limitan LocalStorage a ~5 millones de caracteres
     * por origen (UTF-16, ~10 MB); `total` se expresa en bytes.
     */
    usage() {
      const byCollection = {};
      let chars = 0;
      for (const k of storageKeys(storage)) {
        if (!k.startsWith(prefix) && k !== metaKey) continue;
        const n = (storage.getItem(k) || '').length + k.length;
        byCollection[k.replace(prefix, '')] = n * 2;
        chars += n;
      }
      return { chars, total: chars * 2, quotaChars: 5_000_000, byCollection };
    },

    /** Escucha cambios de otras pestañas para invalidar la caché. */
    bindExternalChanges() {
      return bindStorageEvents(prefix, (c) => cache.delete(c));
    },
  };

  return ds;
}
