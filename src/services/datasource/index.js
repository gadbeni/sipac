/**
 * Selección de la fuente de datos según VITE_DATA_SOURCE (local | api).
 */
import { appConfig } from '@/config/app.config';
import { createLocalDataSource } from './localDataSource';
import { createApiDataSource } from './apiDataSource';
import { getBrowserStorage } from './storage';

const { storagePrefix, schemaVersion } = appConfig.data;
export const STORAGE_PREFIX = `${storagePrefix}:v${schemaVersion}:`;
export const META_KEY = `${storagePrefix}:meta`;

let instance = null;

/**
 * Serializa las transacciones entre pestañas con la Web Locks API: LocalStorage no garantiza
 * exclusión mutua entre pestañas, así que dos aprobaciones simultáneas podrían leer el mismo
 * "último cupo". Con el bloqueo, la segunda relee el estado ya escrito y recibe CUPO_AGOTADO.
 * `transaction` pasa a devolver una promesa; `raw` conserva la versión síncrona (siembra).
 */
export function withCrossTabLock(base) {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return base;
  return {
    ...base,
    raw: base,
    transaction: (collections, fn, opts) =>
      navigator.locks.request('sipac-datos', () => base.transaction(collections, fn, opts)),
  };
}

export function getDataSource() {
  if (!instance) {
    instance =
      appConfig.data.source === 'api'
        ? createApiDataSource({ baseUrl: appConfig.data.apiUrl })
        : withCrossTabLock(
            createLocalDataSource({
              storage: getBrowserStorage(),
              prefix: STORAGE_PREFIX,
              metaKey: META_KEY,
            }),
          );
  }
  return instance;
}

/** Reemplaza la instancia (pruebas). */
export function setDataSource(ds) {
  instance = ds;
}
