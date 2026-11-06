/**
 * Servicio de centros de salud (BUSINESS_RULES §2, RN-CEN-01..06).
 * Lecturas públicas: solo centros activos (RN-CEN-03). Escrituras: transacción + validación.
 * Las operaciones de gestión reciben `session` y exigen `centros.gestionar` (RN-CEN-02).
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { centerSchema } from './schemas/centerSchema';
import { centerFacets, filterCenters, groupWeeklyHours, openStatus, weeklyHours } from './rules/centers';
import { COLLECTIONS, ID_PREFIX } from '@/config/constants';
import { assertPermission } from './auth/guards';
import { currentTime, today } from '@/utils/dates';

const C = COLLECTIONS;
const ds = () => getDataSource();

const withStatus = (center, snap, fecha = today(), hora = currentTime()) => ({
  ...center,
  estadoApertura: openStatus(center, fecha, hora, snap.excepcionesAgenda),
});

/** Especialidades activas que ofrece el centro (catálogo + configuración local). */
function specialtiesOf(snap, centroId) {
  const byId = new Map(snap.especialidades.map((e) => [e.id, e]));
  return snap.centroEspecialidades
    .filter((ce) => ce.centroId === centroId && ce.activo && byId.get(ce.especialidadId)?.activo)
    .map((ce) => {
      const e = byId.get(ce.especialidadId);
      return {
        id: e.id,
        codigo: e.codigo,
        nombre: e.nombre,
        icono: e.icono,
        descripcion: ce.descripcionLocal || e.descripcion,
        aceptaSolicitudesPublicas: ce.aceptaSolicitudesPublicas,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function parseOrThrow(data) {
  const r = centerSchema.safeParse(data);
  if (!r.success) {
    const fields = Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
    throw new AppError('VALIDACION', undefined, { fields });
  }
  return r.data;
}

/** Datos del formulario → registro del modelo. */
function toRecord(v) {
  return {
    codigo: v.codigo,
    codigoCorto: v.codigoCorto,
    nombre: v.nombre,
    tipo: v.tipo,
    nivelAtencion: v.nivelAtencion,
    descripcion: v.descripcion ?? null,
    direccion: v.direccion,
    departamento: 'Beni',
    provincia: v.provincia,
    municipio: v.municipio,
    localidad: v.localidad,
    latitud: v.latitud,
    longitud: v.longitud,
    telefono: v.telefono,
    email: v.email ?? null,
    horarioGeneral: groupWeeklyHours(v.horario),
  };
}

/** Registro → valores del formulario. */
export function centerToForm(c) {
  return {
    codigo: c?.codigo ?? '',
    codigoCorto: c?.codigoCorto ?? '',
    nombre: c?.nombre ?? '',
    tipo: c?.tipo ?? 'centro_salud',
    nivelAtencion: c?.nivelAtencion ?? 'primer_nivel',
    descripcion: c?.descripcion ?? '',
    direccion: c?.direccion ?? '',
    provincia: c?.provincia ?? 'Cercado',
    municipio: c?.municipio ?? 'Trinidad',
    localidad: c?.localidad ?? 'Trinidad',
    latitud: c?.latitud ?? '',
    longitud: c?.longitud ?? '',
    telefono: c?.telefono ?? '',
    email: c?.email ?? '',
    horario: weeklyHours(
      c || { horarioGeneral: [{ dias: [1, 2, 3, 4, 5], apertura: '07:00', cierre: '19:00' }] },
    ).map((r) => ({
      dia: r.dia,
      abierto: Boolean(r.apertura),
      apertura: r.apertura || '08:00',
      cierre: r.cierre || '16:00',
    })),
    diasAnticipacionMax: c?.config?.diasAnticipacionMax ?? 14,
    cierreMismoDiaMin: c?.config?.cierreMismoDiaMin ?? 60,
  };
}

function assertUnique(tx, rec, exceptId) {
  const others = tx.filter(C.centros, (c) => c.id !== exceptId);
  const fields = {};
  if (others.some((c) => c.codigo === rec.codigo)) fields.codigo = 'Ya existe un centro con este código.';
  if (others.some((c) => c.codigoCorto === rec.codigoCorto))
    fields.codigoCorto = 'Ya existe un centro con este código corto.';
  if (Object.keys(fields).length) throw new AppError('DUPLICADO', undefined, { fields });
}

export const centerService = {
  // ------------------------------------------------------------------ Portal
  /** Centros activos filtrados, con distancia y estado de apertura actual. */
  async listPublic(filters = {}) {
    await delay();
    const snap = ds().snapshot([C.centros, C.excepcionesAgenda]);
    return filterCenters(snap.centros, { ...filters, soloActivos: true }).map((c) => withStatus(c, snap));
  },

  async getFacets() {
    await delay(0);
    return centerFacets(ds().snapshot([C.centros]).centros);
  },

  /** Lectura síncrona de un centro activo por id (uso interno del contexto). */
  getActiveSync(id) {
    const c = id ? ds().get(C.centros, id) : null;
    return c && c.activo ? c : null;
  },

  /**
   * Detalle público por código corto (CSC) o institucional (BEN-TRI-0001), sin distinguir mayúsculas.
   * Devuelve null si no existe o está inactivo (RN-CEN-03).
   */
  async getPublicDetail(code) {
    await delay();
    const snap = ds().snapshot([C.centros, C.excepcionesAgenda, C.especialidades, C.centroEspecialidades]);
    const k = String(code || '').toUpperCase();
    const c = snap.centros.find((x) => x.codigoCorto === k || x.codigo === k);
    if (!c || !c.activo) return null;
    return { ...withStatus(c, snap), especialidades: specialtiesOf(snap, c.id) };
  },

  // ------------------------------------------------------------------ Gestión (admin central)
  /** Todos los centros (incluye inactivos) con conteos para la tabla del panel. */
  async listAll(session) {
    await delay();
    assertPermission(session, 'centros.gestionar');
    const snap = ds().snapshot([C.centros, C.centroEspecialidades, C.medicoCentros, C.excepcionesAgenda]);
    return snap.centros
      .map((c) => ({
        ...withStatus(c, snap),
        especialidadesActivas: snap.centroEspecialidades.filter((x) => x.centroId === c.id && x.activo)
          .length,
        medicosActivos: snap.medicoCentros.filter((x) => x.centroId === c.id && x.activo).length,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  },

  /** Fichas futuras confirmadas del centro (aviso antes de desactivar, RN-CEN-04). */
  countFutureConfirmed(session, centroId) {
    assertPermission(session, 'centros.gestionar');
    const hoy = today();
    return ds().list(C.fichas, { centroId, estado: 'confirmada', fecha: (f) => f >= hoy }).length;
  },

  async create(session, values) {
    await delay();
    assertPermission(session, 'centros.gestionar');
    const v = parseOrThrow(values);
    return ds().transaction([C.centros], (tx) => {
      const rec = toRecord(v);
      assertUnique(tx, rec);
      return tx.insert(
        C.centros,
        {
          ...rec,
          imagen: null,
          config: {
            diasAnticipacionMax: v.diasAnticipacionMax,
            cierreMismoDiaMin: v.cierreMismoDiaMin,
            factorLimitePendientes: 2,
          },
          activo: true,
        },
        ID_PREFIX.centros,
      );
    });
  },

  async update(session, id, values) {
    await delay();
    assertPermission(session, 'centros.gestionar');
    const v = parseOrThrow(values);
    return ds().transaction([C.centros], (tx) => {
      const prev = tx.get(C.centros, id);
      if (!prev) throw new AppError('NO_ENCONTRADO');
      // RN-CEN-06: el código corto forma parte de los códigos de solicitud ya emitidos.
      if (v.codigoCorto !== prev.codigoCorto) {
        throw new AppError('VALIDACION', 'El código corto no se puede modificar.', {
          fields: { codigoCorto: 'No se puede modificar: forma parte de los códigos de solicitud emitidos.' },
        });
      }
      const rec = toRecord(v);
      assertUnique(tx, rec, id);
      return tx.update(C.centros, id, {
        ...rec,
        config: {
          ...prev.config,
          diasAnticipacionMax: v.diasAnticipacionMax,
          cierreMismoDiaMin: v.cierreMismoDiaMin,
        },
      });
    });
  },

  /** Activa o desactiva. No cancela fichas existentes (RN-CEN-04): solo deja de aceptar nuevas. */
  async setActive(session, id, activo) {
    await delay();
    assertPermission(session, 'centros.gestionar');
    return ds().transaction([C.centros], (tx) => {
      if (!tx.get(C.centros, id)) throw new AppError('NO_ENCONTRADO');
      return tx.update(C.centros, id, { activo });
    });
  },
};
