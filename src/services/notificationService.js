/**
 * Notificaciones internas del panel (navbar). Una notificación es visible para la sesión si
 * es de un centro accesible (o global) y va dirigida a su rol o a su usuario.
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { assertSession, canAccessCenter } from './auth/guards';
import { AppError } from './errors';
import { COLLECTIONS as C } from '@/config/constants';

const ds = () => getDataSource();

export function isVisibleTo(n, session) {
  if (!session) return false;
  if (n.destinoUsuarioId && n.destinoUsuarioId !== session.usuarioId) return false;
  if (
    !n.destinoUsuarioId &&
    n.destinoRoles?.length &&
    !n.destinoRoles.includes(session.rol) &&
    session.rol !== 'admin_central'
  )
    return false;
  if (n.centroId && !canAccessCenter(session, n.centroId)) return false;
  // Con un centro de trabajo elegido, solo se muestran las de ese centro (y las globales).
  if (n.centroId && session.activeCenterId && n.centroId !== session.activeCenterId) return false;
  return true;
}

export const notificationService = {
  async list(session, { limit = 30 } = {}) {
    await delay(0);
    assertSession(session);
    const centros = new Map(
      ds()
        .list(C.centros)
        .map((c) => [c.id, c.nombre]),
    );
    return ds()
      .list(C.notificaciones)
      .filter((n) => isVisibleTo(n, session))
      .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))
      .slice(0, limit)
      .map((n) => ({
        ...n,
        leida: (n.leidaPor || []).includes(session.usuarioId),
        centro: n.centroId ? centros.get(n.centroId) : null,
      }));
  },

  async markRead(session, id) {
    await delay(0);
    assertSession(session);
    return ds().transaction([C.notificaciones], (tx) => {
      const n = tx.get(C.notificaciones, id);
      if (!n || !isVisibleTo(n, session)) throw new AppError('NO_ENCONTRADO');
      if ((n.leidaPor || []).includes(session.usuarioId)) return n;
      return tx.update(C.notificaciones, id, { leidaPor: [...(n.leidaPor || []), session.usuarioId] });
    });
  },

  async markAllRead(session) {
    await delay(0);
    assertSession(session);
    return ds().transaction([C.notificaciones], (tx) => {
      let n = 0;
      for (const x of tx.all(C.notificaciones)) {
        if (isVisibleTo(x, session) && !(x.leidaPor || []).includes(session.usuarioId)) {
          tx.update(C.notificaciones, x.id, { leidaPor: [...(x.leidaPor || []), session.usuarioId] });
          n += 1;
        }
      }
      return n;
    });
  },
};
