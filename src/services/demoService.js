/**
 * Operaciones sobre los datos de demostración (RN-DEM-01, RN-DEM-02).
 */
import { getDataSource, setDataSource, STORAGE_PREFIX, META_KEY } from './datasource';
import { createLocalDataSource } from './datasource/localDataSource';
import { createMemoryStorage } from './datasource/storage';
import { isAppError } from './errors';
import { needsSeed, refreshDemoData } from './seed/refreshDemoData';

// Los JSON semilla (~250 kB) se descargan solo cuando hay que sembrar (primer uso o restauración).
const loadSeed = () => import('./seed/initDemoData');

async function ensure(ds) {
  if (!needsSeed(ds)) return refreshDemoData(ds);
  const { seedDemoData } = await loadSeed();
  return { seeded: true, ...seedDemoData(ds) };
}
import { validateIntegrity } from './rules/integrity';
import { COLLECTIONS } from '@/config/constants';
import { delay } from './repositories/createRepository';

export { SESSION_KEY } from './authService';
import { SESSION_KEY } from './authService';

export const demoService = {
  /** Se llama una vez al iniciar la aplicación (antes del primer render). */
  async initialize() {
    const ds = getDataSource();
    if (ds.kind !== 'local') return { seeded: false };
    try {
      const result = await ensure(ds);
      ds.bindExternalChanges();
      return { ...result, storage: 'localStorage' };
    } catch (e) {
      if (!isAppError(e, 'ALMACENAMIENTO_LLENO')) throw e;
      // Cuota insuficiente (p. ej. Safari en modo privado): se trabaja en memoria hasta recargar.
      console.warn('[SIPAC] LocalStorage sin espacio: los datos se mantendrán solo en memoria.');
      const memory = createLocalDataSource({
        storage: createMemoryStorage(),
        prefix: STORAGE_PREFIX,
        metaKey: META_KEY,
      });
      setDataSource(memory);
      return { ...(await ensure(memory)), storage: 'memoria' };
    }
  },

  /** Restaura los datos de demostración y cierra la sesión (conserva preferencias). */
  async resetDemoData() {
    await delay();
    const ds = getDataSource();
    const { seedDemoData } = await loadSeed();
    const result = seedDemoData(ds);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* sin localStorage */
    }
    return result;
  },

  getMeta: () => getDataSource().getMeta(),

  getStorageUsage: () => getDataSource().usage(),

  /** Resumen de cantidades por colección y verificación de integridad. */
  getHealth() {
    const ds = getDataSource();
    const data = ds.snapshot(Object.values(COLLECTIONS));
    return {
      counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
      errors: validateIntegrity(data),
      meta: ds.getMeta(),
      usage: ds.usage(),
    };
  },
};
