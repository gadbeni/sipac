/**
 * Usuarios del personal (RN-USR-03): el admin central gestiona; el admin de centro solo lee
 * los usuarios de su centro. Nunca se devuelve la contraseña.
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { assertCenterAccess, assertPermission, can } from './auth/guards';
import { allowedCenters } from './authService';
import { passwordRule, userSchema } from './schemas/userSchema';
import { COLLECTIONS as C, ID_PREFIX, ROLES } from '@/config/constants';
import { compareText } from '@/utils/text';

const ds = () => getDataSource();
export const TEMP_PASSWORD = 'Demo2026!';

const publicUser = (u, centros) => {
  const { password: _pw, ...rest } = u;
  return {
    ...rest,
    rolLabel: ROLES[u.rol],
    centrosLabel:
      u.rol === 'admin_central'
        ? 'Todos los centros'
        : allowedCenters(u)
            .map((id) => centros.get(id)?.nombre || id)
            .join(' · ') || 'Sin centro',
    centrosIds: u.rol === 'admin_central' ? null : allowedCenters(u),
  };
};

function parseOrThrow(values) {
  const r = userSchema.safeParse(values);
  if (!r.success)
    throw new AppError('VALIDACION', undefined, {
      fields: Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message])),
    });
  return r.data;
}

function assertRefs(tx, v) {
  if (v.centroId && !tx.get(C.centros, v.centroId))
    throw new AppError('VALIDACION', undefined, { fields: { centroId: 'Centro inexistente.' } });
  if (v.medicoId) {
    const m = tx.get(C.medicos, v.medicoId);
    if (!m || !m.activo)
      throw new AppError('VALIDACION', undefined, {
        fields: { medicoId: 'Profesional inexistente o inactivo.' },
      });
    const other = tx.find(C.usuarios, (u) => u.medicoId === v.medicoId && u.id !== v.id);
    if (other)
      throw new AppError('DUPLICADO', undefined, {
        fields: { medicoId: `El profesional ya tiene el usuario ${other.username}.` },
      });
  }
}

export const userService = {
  /**
   * Lista de usuarios. Admin central: todos (o un centro). Admin de centro: solo su centro;
   * pedir otro centro lanza ACCESO_DENEGADO.
   */
  async list(session, { centroId } = {}) {
    await delay();
    assertPermission(session, ['usuarios.gestionar', 'usuarios.ver']);
    const scope = can(session, 'usuarios.gestionar') ? centroId || null : centroId || session.centroId;
    if (scope) assertCenterAccess(session, scope);
    const centros = new Map(
      ds()
        .list(C.centros)
        .map((c) => [c.id, c]),
    );
    return ds()
      .list(C.usuarios)
      .map((u) => publicUser(u, centros))
      .filter((u) => !scope || (u.centrosIds || []).includes(scope))
      .sort((a, b) => compareText(a.nombre, b.nombre));
  },

  async create(session, values) {
    await delay();
    assertPermission(session, 'usuarios.gestionar');
    const v = parseOrThrow(values);
    if (!passwordRule(values.password))
      throw new AppError('VALIDACION', undefined, {
        fields: { password: 'Mínimo 8 caracteres, con letras y números.' },
      });
    return ds().transaction([C.usuarios, C.centros, C.medicos], (tx) => {
      if (tx.find(C.usuarios, (u) => u.username === v.username))
        throw new AppError('DUPLICADO', undefined, {
          fields: { username: 'Ya existe un usuario con ese nombre.' },
        });
      assertRefs(tx, v);
      const u = tx.insert(
        C.usuarios,
        {
          username: v.username,
          password: values.password,
          nombre: v.nombre,
          email: v.email,
          rol: v.rol,
          centroId: v.centroId,
          medicoId: v.medicoId,
          avatar: null,
          activo: true,
          ultimoAcceso: null,
        },
        ID_PREFIX.usuarios,
      );
      return publicUser(u, new Map(tx.all(C.centros).map((c) => [c.id, c])));
    });
  },

  async update(session, id, values) {
    await delay();
    assertPermission(session, 'usuarios.gestionar');
    const v = parseOrThrow(values);
    return ds().transaction([C.usuarios, C.centros, C.medicos], (tx) => {
      const prev = tx.get(C.usuarios, id);
      if (!prev) throw new AppError('NO_ENCONTRADO');
      if (tx.find(C.usuarios, (u) => u.username === v.username && u.id !== id))
        throw new AppError('DUPLICADO', undefined, {
          fields: { username: 'Ya existe un usuario con ese nombre.' },
        });
      if (id === session.usuarioId && v.rol !== prev.rol)
        throw new AppError('VALIDACION', 'No puede cambiar su propio rol.', {
          fields: { rol: 'No puede cambiar su propio rol.' },
        });
      assertRefs(tx, { ...v, id });
      const u = tx.update(C.usuarios, id, {
        username: v.username,
        nombre: v.nombre,
        email: v.email,
        rol: v.rol,
        centroId: v.centroId,
        medicoId: v.medicoId,
      });
      return publicUser(u, new Map(tx.all(C.centros).map((c) => [c.id, c])));
    });
  },

  async setActive(session, id, activo) {
    await delay();
    assertPermission(session, 'usuarios.gestionar');
    if (id === session.usuarioId && !activo)
      throw new AppError('VALIDACION', 'No puede desactivar su propio usuario.');
    return ds().transaction([C.usuarios], (tx) => {
      if (!tx.get(C.usuarios, id)) throw new AppError('NO_ENCONTRADO');
      return tx.update(C.usuarios, id, { activo }).activo;
    });
  },

  /** Restablece una contraseña temporal (simulado). */
  async resetPassword(session, id) {
    await delay();
    assertPermission(session, 'usuarios.gestionar');
    await ds().transaction([C.usuarios], (tx) => {
      if (!tx.get(C.usuarios, id)) throw new AppError('NO_ENCONTRADO');
      tx.update(C.usuarios, id, { password: TEMP_PASSWORD });
    });
    return TEMP_PASSWORD;
  },

  /** Opciones para el formulario: centros y profesionales activos. */
  formOptions(session) {
    assertPermission(session, 'usuarios.gestionar');
    return {
      centros: ds()
        .list(C.centros)
        .map((c) => ({ value: c.id, label: `${c.nombre}${c.activo ? '' : ' (inactivo)'}` })),
      medicos: ds()
        .list(C.medicos, { activo: true })
        .map((m) => ({ value: m.id, label: `${m.nombres} ${m.apellidos}` }))
        .sort((a, b) => compareText(a.label, b.label)),
    };
  },
};
