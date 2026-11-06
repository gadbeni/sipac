/**
 * Autenticación SIMULADA (no apta para producción): las credenciales están en el JSON local y
 * la sesión es un objeto en LocalStorage con expiración de 8 h (RN-USR-04).
 * En la migración a Laravel se reemplaza por Sanctum (login → token) sin cambiar los consumidores.
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { COLLECTIONS as C, LIMITES, PERMISOS_POR_ROL, ROLES } from '@/config/constants';
import { appConfig } from '@/config/app.config';
import { now, nowIso } from '@/utils/dates';
import { compareText } from '@/utils/text';

export const SESSION_KEY = `${appConfig.data.storagePrefix}:session`;
const ds = () => getDataSource();

let memorySession = null; // respaldo sin localStorage (pruebas, modo privado)
const store = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return memorySession;
    }
  },
  write(s) {
    memorySession = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* sin localStorage */
    }
  },
};

/** Centros en los que puede operar el usuario (RN-USR-02). */
export function allowedCenters(user) {
  const centros = ds().list(C.centros);
  if (user.rol === 'admin_central') return centros.map((c) => c.id);
  if (user.rol === 'medico') {
    const activos = new Set(centros.filter((c) => c.activo).map((c) => c.id));
    return [
      ...new Set(
        ds()
          .list(C.medicoCentros, { medicoId: user.medicoId, activo: true })
          .map((mc) => mc.centroId),
      ),
    ].filter((id) => activos.has(id));
  }
  return user.centroId ? [user.centroId] : [];
}

function buildSession(user, prev = null) {
  const centrosPermitidos = allowedCenters(user);
  let activeCenterId = prev?.activeCenterId;
  if (user.rol === 'admin_central') activeCenterId = activeCenterId === undefined ? null : activeCenterId;
  if (activeCenterId !== null && !centrosPermitidos.includes(activeCenterId))
    activeCenterId = centrosPermitidos[0] ?? null;
  const t = now();
  return {
    usuarioId: user.id,
    username: user.username,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    rolLabel: ROLES[user.rol],
    centroId: user.centroId,
    medicoId: user.medicoId,
    centrosPermitidos,
    activeCenterId,
    permisos: PERMISOS_POR_ROL[user.rol] || [],
    iniciadaEn: prev?.iniciadaEn || t.format('YYYY-MM-DDTHH:mm:ssZ'),
    expiraEn: prev?.expiraEn || t.add(LIMITES.sesionHoras, 'hour').format('YYYY-MM-DDTHH:mm:ssZ'),
  };
}

export const authService = {
  /** Valida credenciales. Requiere conexión: en producción es una llamada al servidor. */
  async login(username, password) {
    await delay();
    const u = String(username || '')
      .trim()
      .toLowerCase();
    const user = ds()
      .list(C.usuarios)
      .find((x) => x.username.toLowerCase() === u);
    // Mensaje único: no revela si el usuario existe (equivalente a RN-PAC-04 para el personal).
    if (!user || user.password !== password) throw new AppError('CREDENCIALES_INVALIDAS');
    if (!user.activo) throw new AppError('USUARIO_INACTIVO');
    if (user.rol !== 'admin_central' && !allowedCenters(user).length)
      throw new AppError('USUARIO_SIN_CENTRO');
    await ds().transaction([C.usuarios], (tx) => tx.update(C.usuarios, user.id, { ultimoAcceso: nowIso() }));
    const s = buildSession(user);
    store.write(s);
    return s;
  },

  logout() {
    store.write(null);
  },

  /**
   * Sesión vigente o null. Revalida contra los datos: usuario desactivado, centros cambiados
   * (p. ej. médico desvinculado) o sesión vencida cierran o actualizan la sesión.
   */
  getSession() {
    const s = store.read();
    if (!s) return null;
    if (!s.expiraEn || now().isAfter(s.expiraEn)) {
      store.write(null);
      return { expired: true };
    }
    const user = ds().get(C.usuarios, s.usuarioId);
    if (!user || !user.activo) {
      store.write(null);
      return null;
    }
    const fresh = buildSession(user, s);
    if (JSON.stringify(fresh) !== JSON.stringify(s)) store.write(fresh);
    return fresh;
  },

  /** Cambia el centro de trabajo (admin central y médico multicentro). `null` = todos (central). */
  setActiveCenter(session, centroId) {
    const s = this.getSession();
    if (!s || s.expired || s.usuarioId !== session?.usuarioId)
      throw new AppError('ACCESO_DENEGADO', 'Debe iniciar sesión.');
    if (centroId === null && s.rol !== 'admin_central') throw new AppError('ACCESO_DENEGADO');
    if (centroId !== null && !s.centrosPermitidos.includes(centroId)) throw new AppError('ACCESO_DENEGADO');
    if (centroId !== s.activeCenterId && s.rol !== 'admin_central' && s.rol !== 'medico')
      throw new AppError('PERMISO_DENEGADO');
    const next = { ...s, activeCenterId: centroId };
    store.write(next);
    return next;
  },

  /** Cambio de contraseña simulado (RN-USR-04). */
  async changePassword(session, { actual, nueva, confirmacion }) {
    await delay();
    if (!session?.usuarioId) throw new AppError('ACCESO_DENEGADO');
    const fields = {};
    if (!nueva || nueva.length < 8) fields.nueva = 'Debe tener al menos 8 caracteres.';
    else if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) fields.nueva = 'Debe combinar letras y números.';
    if (nueva !== confirmacion) fields.confirmacion = 'Las contraseñas no coinciden.';
    if (nueva && nueva === actual) fields.nueva = 'Debe ser distinta de la actual.';
    if (Object.keys(fields).length) throw new AppError('VALIDACION', undefined, { fields });
    return ds().transaction([C.usuarios], (tx) => {
      const u = tx.get(C.usuarios, session.usuarioId);
      if (!u) throw new AppError('NO_ENCONTRADO');
      if (u.password !== actual)
        throw new AppError('VALIDACION', 'La contraseña actual no es correcta.', {
          fields: { actual: 'La contraseña actual no es correcta.' },
        });
      tx.update(C.usuarios, u.id, { password: nueva });
      return true;
    });
  },

  /** Usuarios para el panel "Usuarios de demostración" del login (solo activos). */
  demoUsers() {
    const centros = new Map(
      ds()
        .list(C.centros)
        .map((c) => [c.id, c]),
    );
    const order = Object.keys(ROLES);
    return ds()
      .list(C.usuarios, { activo: true })
      .map((u) => ({
        username: u.username,
        nombre: u.nombre,
        rol: ROLES[u.rol],
        rolKey: u.rol,
        centros:
          u.rol === 'admin_central'
            ? 'Todos los centros'
            : allowedCenters(u)
                .map((id) => centros.get(id)?.nombre)
                .join(' · '),
        password: appConfig.demo.enabled ? u.password : null,
      }))
      .sort(
        (a, b) => order.indexOf(a.rolKey) - order.indexOf(b.rolKey) || compareText(a.username, b.username),
      );
  },
};
