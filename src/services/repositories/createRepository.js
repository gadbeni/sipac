/**
 * Repositorio genérico asíncrono sobre la fuente de datos.
 * Las lecturas simulan latencia para que la UI tenga estados de carga reales.
 * Operaciones de negocio con varias colecciones deben usar `ds.transaction` desde los servicios.
 */
import { appConfig } from '@/config/app.config';
import { getDataSource } from '../datasource';
import { matchWhere } from '../datasource/localDataSource';

let latencyMs = appConfig.data.fakeLatencyMs;
export const setLatency = (ms) => {
  latencyMs = ms;
};

export const delay = (ms = latencyMs) =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms * (0.75 + Math.random() * 0.5))) : Promise.resolve();

function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return typeof a === 'string' ? a.localeCompare(b, 'es') : a - b;
}

/**
 * @param {string} collection
 * @param {{ idPrefix?: string, ds?: () => object }} options
 */
export function createRepository(collection, { idPrefix, ds = getDataSource } = {}) {
  return {
    collection,

    /**
     * @param {{ where?: object, filter?: (it) => boolean, sort?: string | {field: string, dir?: 'asc'|'desc'}[],
     *           page?: number, pageSize?: number }} [opts]
     * @returns {Promise<object[] | {items: object[], total: number, page: number, pageSize: number}>}
     */
    async list({ where, filter, sort, page, pageSize } = {}) {
      await delay();
      let items = ds().list(collection);
      if (where) items = items.filter((it) => matchWhere(it, where));
      if (filter) items = items.filter(filter);
      if (sort) {
        const specs =
          typeof sort === 'string'
            ? [{ field: sort.replace(/^-/, ''), dir: sort.startsWith('-') ? 'desc' : 'asc' }]
            : sort;
        items.sort((x, y) => {
          for (const { field, dir = 'asc' } of specs) {
            const r = compare(x[field], y[field]);
            if (r) return dir === 'desc' ? -r : r;
          }
          return 0;
        });
      }
      if (page !== undefined && pageSize) {
        const total = items.length;
        return { items: items.slice(page * pageSize, page * pageSize + pageSize), total, page, pageSize };
      }
      return items;
    },

    async getById(id) {
      await delay();
      return ds().get(collection, id);
    },

    async findOne(where) {
      await delay();
      return ds().list(collection, where)[0] || null;
    },

    async count(where) {
      await delay(0);
      return ds().list(collection, where).length;
    },

    async create(data) {
      await delay();
      return ds().transaction([collection], (tx) => tx.insert(collection, data, idPrefix));
    },

    async update(id, patch) {
      await delay();
      return ds().transaction([collection], (tx) => tx.update(collection, id, patch));
    },

    /** Solo para catálogos sin referencias; los datos operativos se anulan por estado. */
    async remove(id) {
      await delay();
      return ds().transaction([collection], (tx) => tx.remove(collection, id));
    },
  };
}
