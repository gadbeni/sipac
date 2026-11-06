/**
 * Especialidades: configuración por centro (`especialidades.gestionar`, RN-ESP-01..05) y
 * catálogo global (`especialidades.catalogo`, solo administración central).
 */
import { z } from 'zod';
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { assertPermission, scopeCenter } from './auth/guards';
import { COLLECTIONS as C, ID_PREFIX } from '@/config/constants';
import { compareText } from '@/utils/text';

const ds = () => getDataSource();
const ALL = Object.values(C);
export const ICONOS = [
  'MedicalServices',
  'ChildCare',
  'Female',
  'SentimentVerySatisfied',
  'Vaccines',
  'RestaurantMenu',
  'Psychology',
  'PregnantWoman',
];

const catalogSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, 'De 2 a 4 letras (prefijo de la ficha, p. ej. MG).'),
  nombre: z.string().trim().min(3, 'Ingrese el nombre.').max(60),
  descripcion: z.string().trim().min(5, 'Ingrese una descripción.').max(200),
  icono: z.enum(ICONOS),
});

const configSchema = z.object({
  activo: z.boolean(),
  aceptaSolicitudesPublicas: z.boolean(),
  asignacionMedico: z.enum(['elegible', 'automatica']),
  descripcionLocal: z.string().trim().max(200).optional().nullable(),
});

function workCenter(session) {
  const c = scopeCenter(session);
  if (!c) throw new AppError('VALIDACION', 'Elija un centro de trabajo en la barra superior.');
  return c;
}

export const specialtyAdminService = {
  ICONOS,

  /** Catálogo con la configuración del centro de trabajo y su oferta (médicos, horarios, cupos). */
  async listForCenter(session) {
    await delay();
    assertPermission(session, 'especialidades.gestionar');
    const centroId = workCenter(session);
    const snap = ds().snapshot(ALL);
    return snap.especialidades
      .map((e) => {
        const ce =
          snap.centroEspecialidades.find((x) => x.centroId === centroId && x.especialidadId === e.id) || null;
        const hs = snap.horarios.filter(
          (h) => h.centroId === centroId && h.especialidadId === e.id && h.activo,
        );
        const medicos = new Set(
          snap.medicoCentros
            .filter((mc) => mc.centroId === centroId && mc.activo && mc.especialidadIds.includes(e.id))
            .map((mc) => mc.medicoId),
        );
        return {
          ...e,
          config: ce,
          ofrecida: Boolean(ce?.activo),
          medicos: medicos.size,
          horarios: hs.length,
          cuposSemana: hs.reduce((s, h) => s + h.cupos, 0),
          cuposWebSemana: hs.reduce((s, h) => s + h.cuposPublicos, 0),
          visiblePortal: Boolean(ce?.activo && e.activo && hs.length), // RN-ESP-02
        };
      })
      .sort((a, b) => compareText(a.nombre, b.nombre));
  },

  /** Activa o configura una especialidad en el centro (crea el vínculo si no existe). RN-ESP-03. */
  async configure(session, especialidadId, values) {
    await delay();
    assertPermission(session, 'especialidades.gestionar');
    const centroId = workCenter(session);
    const r = configSchema.safeParse(values);
    if (!r.success) throw new AppError('VALIDACION');
    const v = r.data;
    return ds().transaction(ALL, (tx) => {
      const e = tx.get(C.especialidades, especialidadId);
      if (!e) throw new AppError('NO_ENCONTRADO');
      if (v.activo && !e.activo)
        throw new AppError('VALIDACION', 'La especialidad está desactivada en el catálogo de la red.');
      const prev = tx.find(
        C.centroEspecialidades,
        (x) => x.centroId === centroId && x.especialidadId === especialidadId,
      );
      const data = {
        activo: v.activo,
        aceptaSolicitudesPublicas: v.aceptaSolicitudesPublicas,
        asignacionMedico: v.asignacionMedico,
        descripcionLocal: v.descripcionLocal || null,
      };
      return prev
        ? tx.update(C.centroEspecialidades, prev.id, data)
        : tx.insert(
            C.centroEspecialidades,
            { centroId, especialidadId, ...data },
            ID_PREFIX.centroEspecialidades,
          );
    });
  },

  // ------------------------------------------------------------------ Catálogo global
  async listCatalog(session) {
    await delay();
    assertPermission(session, 'especialidades.catalogo');
    return ds()
      .list(C.especialidades)
      .sort((a, b) => compareText(a.nombre, b.nombre));
  },

  async createCatalog(session, values) {
    await delay();
    assertPermission(session, 'especialidades.catalogo');
    const r = catalogSchema.safeParse(values);
    if (!r.success)
      throw new AppError('VALIDACION', undefined, {
        fields: Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message])),
      });
    return ds().transaction(ALL, (tx) => {
      if (tx.find(C.especialidades, (e) => e.codigo === r.data.codigo))
        throw new AppError('DUPLICADO', undefined, { fields: { codigo: 'Código ya usado.' } });
      if (tx.find(C.especialidades, (e) => e.nombre.toLowerCase() === r.data.nombre.toLowerCase()))
        throw new AppError('DUPLICADO', undefined, { fields: { nombre: 'Ya existe.' } });
      return tx.insert(C.especialidades, { ...r.data, activo: true }, ID_PREFIX.especialidades);
    });
  },

  /** El código no se cambia: forma parte de los números de ficha emitidos (MG-07). */
  async updateCatalog(session, id, values) {
    await delay();
    assertPermission(session, 'especialidades.catalogo');
    const r = catalogSchema.safeParse(values);
    if (!r.success)
      throw new AppError('VALIDACION', undefined, {
        fields: Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message])),
      });
    return ds().transaction(ALL, (tx) => {
      const prev = tx.get(C.especialidades, id);
      if (!prev) throw new AppError('NO_ENCONTRADO');
      if (prev.codigo !== r.data.codigo)
        throw new AppError('VALIDACION', undefined, {
          fields: {
            codigo: 'El código no se puede modificar: forma parte de los números de ficha emitidos.',
          },
        });
      if (
        tx.find(
          C.especialidades,
          (e) => e.id !== id && e.nombre.toLowerCase() === r.data.nombre.toLowerCase(),
        )
      )
        throw new AppError('DUPLICADO', undefined, { fields: { nombre: 'Ya existe.' } });
      return tx.update(C.especialidades, id, {
        nombre: r.data.nombre,
        descripcion: r.data.descripcion,
        icono: r.data.icono,
      });
    });
  },

  async setCatalogActive(session, id, activo) {
    await delay();
    assertPermission(session, 'especialidades.catalogo');
    return ds().transaction(ALL, (tx) => {
      if (!tx.get(C.especialidades, id)) throw new AppError('NO_ENCONTRADO');
      return tx.update(C.especialidades, id, { activo });
    });
  },
};
