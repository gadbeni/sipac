/**
 * Controles de acceso usados por los servicios (RN-USR-01, RN-MC-*). La UI también oculta lo
 * no permitido, pero la barrera real está aquí: en Laravel serán Policies / middleware.
 */
import { AppError } from '../errors';
import { hasPermission } from '@/config/constants';

/** ¿La sesión tiene el permiso? Acepta un permiso o una lista (cualquiera). */
export function can(session, permiso) {
  if (!session) return false;
  const list = Array.isArray(permiso) ? permiso : [permiso];
  return list.some((p) => hasPermission(session.rol, p));
}

export function assertSession(session) {
  if (!session?.usuarioId) throw new AppError('ACCESO_DENEGADO', 'Debe iniciar sesión.');
  return session;
}

export function assertPermission(session, permiso) {
  assertSession(session);
  if (!can(session, permiso)) throw new AppError('PERMISO_DENEGADO');
}

/** El admin central accede a todos los centros; el resto solo a `centrosPermitidos`. */
export function canAccessCenter(session, centroId) {
  if (!session) return false;
  if (session.rol === 'admin_central') return true;
  return (session.centrosPermitidos || []).includes(centroId);
}

export function assertCenterAccess(session, centroId) {
  assertSession(session);
  if (!centroId || !canAccessCenter(session, centroId)) throw new AppError('ACCESO_DENEGADO');
}

/**
 * Centro sobre el que opera una consulta del panel: el pedido explícito (validado) o el
 * centro activo de la sesión. `null` solo para el admin central en vista global.
 */
export function scopeCenter(session, centroId) {
  assertSession(session);
  const id = centroId === undefined ? session.activeCenterId : centroId;
  if (id == null) {
    if (session.rol === 'admin_central') return null;
    throw new AppError('ACCESO_DENEGADO');
  }
  assertCenterAccess(session, id);
  return id;
}
