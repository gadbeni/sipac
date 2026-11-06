/**
 * Fuente de datos HTTP para el futuro backend Laravel (no se usa en el prototipo).
 *
 * Con API, las operaciones de negocio (aprobar, emitir, reprogramar…) se convertirán en
 * endpoints del backend (p. ej. POST /solicitudes/{id}/aprobar) y el servidor será la
 * autoridad de las reglas. Los servicios del frontend conservarán su firma pública; solo
 * cambiará su implementación interna (ARCHITECTURE §10).
 */
import { AppError } from '../errors';

const toSnake = (s) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function mapKeys(value, fn) {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), mapKeys(v, fn)]));
  }
  return value;
}

export const toApi = (obj) => mapKeys(obj, toSnake);
export const fromApi = (obj) => mapKeys(obj, toCamel);

export function createApiDataSource({ baseUrl, getToken = () => null } = {}) {
  async function request(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body ? JSON.stringify(toApi(body)) : undefined,
    });
    if (!res.ok)
      throw new AppError(res.status === 403 ? 'ACCESO_DENEGADO' : 'VALIDACION', `HTTP ${res.status}`);
    return fromApi(await res.json());
  }

  const notImplemented = () => {
    throw new AppError('NO_IMPLEMENTADO', 'La fuente de datos API aún no está implementada.');
  };

  return {
    kind: 'api',
    request,
    list: notImplemented,
    get: notImplemented,
    snapshot: notImplemented,
    transaction: notImplemented,
    replaceAll: notImplemented,
    getMeta: () => null,
    setMeta: notImplemented,
    clearAll: notImplemented,
    invalidate: () => {},
    usage: () => ({ chars: 0, total: 0, quotaChars: 0, byCollection: {} }),
    bindExternalChanges: () => () => {},
  };
}
