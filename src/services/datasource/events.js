/**
 * Bus de eventos "data:changed". Notifica cambios a la misma pestaña (suscriptores locales)
 * y a otras pestañas del mismo navegador (BroadcastChannel + evento `storage`).
 * Limitación aceptada: no sincroniza entre dispositivos (ARCHITECTURE R1).
 */
const listeners = new Set();
let channel = null;

function getChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  try {
    channel = new BroadcastChannel('sipac-data');
    channel.onmessage = (ev) => dispatch(ev.data?.collections || [], { remote: true });
  } catch {
    channel = null;
  }
  return channel;
}

function dispatch(collections, meta) {
  for (const fn of listeners) {
    try {
      fn(collections, meta);
    } catch (e) {
      console.error('[data:changed] listener error', e);
    }
  }
}

/** Emite un cambio en las colecciones indicadas. */
export function emitDataChanged(collections) {
  dispatch(collections, { remote: false });
  getChannel()?.postMessage({ collections });
}

/** Suscribe una función (collections: string[], meta: {remote}) => void. Devuelve la función para desuscribir. */
export function onDataChanged(fn) {
  listeners.add(fn);
  getChannel();
  return () => listeners.delete(fn);
}

/** Conecta el evento `storage` de otras pestañas (respaldo de BroadcastChannel). */
export function bindStorageEvents(prefix, onExternalChange) {
  if (typeof window === 'undefined') return () => {};
  const handler = (ev) => {
    if (!ev.key || !ev.key.startsWith(prefix)) return;
    const collection = ev.key.slice(prefix.length);
    onExternalChange(collection);
    dispatch([collection], { remote: true });
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
