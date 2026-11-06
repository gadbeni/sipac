/**
 * Acceso de bajo nivel a almacenamiento clave/valor.
 * En el navegador usa localStorage; si no está disponible (modo privado, pruebas) usa memoria.
 */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    keys: () => [...map.keys()],
  };
}

export function getBrowserStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probe = '__sipac_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    // localStorage bloqueado: se usa memoria (los datos no persistirán al recargar).
  }
  return createMemoryStorage();
}

/** Claves presentes en un storage (compatible con localStorage y memoria). */
export function storageKeys(storage) {
  if (typeof storage.keys === 'function') return storage.keys();
  const out = [];
  for (let i = 0; i < storage.length; i++) out.push(storage.key(i));
  return out;
}
