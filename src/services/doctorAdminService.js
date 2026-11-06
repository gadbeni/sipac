/**
 * Gestión de médicos y sus vínculos con centros (BUSINESS_RULES §4, RN-MED-01..05, RN-MC-04/05).
 * Permiso `medicos.gestionar`; el vínculo solo lo edita su centro (RN-MED-02).
 */
import { z } from 'zod';
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { assertCenterAccess, assertPermission, canAccessCenter, scopeCenter } from './auth/guards';
import { doctorName } from './rules/portal';
import { COLLECTIONS as C, ID_PREFIX, TIPOS_DOCUMENTO } from '@/config/constants';
import { today } from '@/utils/dates';
import { compareText } from '@/utils/text';

const ds = () => getDataSource();
const ALL = Object.values(C);
const ACTIVA = new Set(['confirmada', 'en_espera', 'llamada', 'en_atencion']);
const NAME = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;

export const doctorSchema = z.object({
  nombres: z.string().trim().min(2, 'Ingrese los nombres.').max(60).regex(NAME, 'Solo letras.'),
  apellidos: z.string().trim().min(2, 'Ingrese los apellidos.').max(60).regex(NAME, 'Solo letras.'),
  tipoDocumento: z.enum(Object.keys(TIPOS_DOCUMENTO), { error: 'Seleccione el tipo.' }),
  numeroDocumento: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,15}$/, 'Entre 5 y 15 letras o números.'),
  registroProfesional: z.string().trim().toUpperCase().min(4, 'Ingrese el registro profesional.').max(30),
  especialidadIds: z.array(z.string()).min(1, 'Seleccione al menos una especialidad.'),
  telefono: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email('Correo inválido.').or(z.literal('')).optional().nullable(),
});

export const linkSchema = z.object({
  especialidadIds: z.array(z.string()).min(1, 'Seleccione al menos una especialidad.'),
  cargo: z.string().trim().min(2, 'Indique el cargo.').max(40),
});

const fieldsOf = (r) => Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
const parse = (schema, v) => {
  const r = schema.safeParse(v);
  if (!r.success) throw new AppError('VALIDACION', undefined, { fields: fieldsOf(r) });
  return r.data;
};

function workCenter(session) {
  const c = scopeCenter(session);
  if (!c) throw new AppError('VALIDACION', 'Elija un centro de trabajo en la barra superior.');
  return c;
}

/** ¿Puede editar datos personales del médico? central o un centro donde está vinculado (RN-MED-02). */
const canEditPersonal = (session, links) =>
  session.rol === 'admin_central' || links.some((l) => canAccessCenter(session, l.centroId));

const futureActive = (fichas, pred) =>
  fichas.filter((f) => f.fecha >= today() && ACTIVA.has(f.estado) && pred(f));

export const doctorAdminService = {
  /** Médicos vinculados al centro de trabajo (activos e inactivos). */
  async list(session) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    const centroId = workCenter(session);
    const snap = ds().snapshot(ALL);
    const esps = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
    return snap.medicoCentros
      .filter((mc) => mc.centroId === centroId)
      .map((mc) => {
        const m = snap.medicos.find((x) => x.id === mc.medicoId);
        const otros = snap.medicoCentros
          .filter((x) => x.medicoId === m.id && x.id !== mc.id && x.activo)
          .map((x) => snap.centros.find((c) => c.id === x.centroId)?.nombre);
        return {
          id: m.id,
          mcId: mc.id,
          nombre: doctorName(m),
          documento: `${m.numeroDocumento}`,
          registro: m.registroProfesional,
          especialidades: mc.especialidadIds.map((e) => esps.get(e)).join(', '),
          cargo: mc.cargo,
          otrosCentros: otros.join(' · '),
          horarios: snap.horarios.filter((h) => h.medicoCentroId === mc.id && h.activo).length,
          fichasFuturas: futureActive(snap.fichas, (f) => f.medicoId === m.id && f.centroId === centroId)
            .length,
          activo: m.activo && mc.activo,
          medicoActivo: m.activo,
          vinculoActivo: mc.activo,
        };
      })
      .sort((a, b) => compareText(a.nombre, b.nombre));
  },

  /** Detección de duplicados por documento (RN-MED-01). */
  findByDocument(session, { tipoDocumento, numeroDocumento }) {
    assertPermission(session, 'medicos.gestionar');
    const n = String(numeroDocumento || '')
      .trim()
      .toUpperCase();
    if (n.length < 5) return null;
    const snap = ds().snapshot([C.medicos, C.medicoCentros, C.centros]);
    const m = snap.medicos.find(
      (x) => x.tipoDocumento === tipoDocumento && x.numeroDocumento.toUpperCase() === n,
    );
    if (!m) return null;
    const links = snap.medicoCentros.filter((x) => x.medicoId === m.id);
    return {
      id: m.id,
      nombre: doctorName(m),
      registro: m.registroProfesional,
      activo: m.activo,
      centros: links.map((l) => ({
        centroId: l.centroId,
        nombre: snap.centros.find((c) => c.id === l.centroId)?.nombre,
        activo: l.activo,
      })),
    };
  },

  async getDetail(session, medicoId) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    const centroId = workCenter(session);
    const snap = ds().snapshot(ALL);
    const m = snap.medicos.find((x) => x.id === medicoId);
    if (!m) throw new AppError('NO_ENCONTRADO');
    const links = snap.medicoCentros.filter((x) => x.medicoId === m.id);
    const local = links.find((l) => l.centroId === centroId);
    if (!local && session.rol !== 'admin_central') throw new AppError('ACCESO_DENEGADO');
    const esps = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
    const cons = new Map(snap.consultorios.map((x) => [x.id, x.nombre]));
    return {
      ...m,
      nombre: doctorName(m),
      editablePersonal: canEditPersonal(session, links),
      vinculos: links.map((l) => ({
        ...l,
        centro: snap.centros.find((c) => c.id === l.centroId)?.nombre,
        especialidades: l.especialidadIds.map((e) => esps.get(e)),
        editable: l.centroId === centroId && canAccessCenter(session, l.centroId),
        fichasFuturas: futureActive(snap.fichas, (f) => f.medicoId === m.id && f.centroId === l.centroId)
          .length,
      })),
      vinculoLocal: local || null,
      horarios: local
        ? snap.horarios
            .filter((h) => h.medicoCentroId === local.id)
            .map((h) => ({
              ...h,
              especialidad: esps.get(h.especialidadId),
              consultorio: cons.get(h.consultorioId),
            }))
            .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
        : [],
      fichasFuturasLocal: local
        ? futureActive(snap.fichas, (f) => f.medicoId === m.id && f.centroId === centroId).length
        : 0,
    };
  },

  /** Alta: si el documento ya existe lanza DUPLICADO con el médico encontrado (la UI ofrece vincularlo). */
  async create(session, values) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    const centroId = workCenter(session);
    const v = parse(doctorSchema, values);
    const link = parse(linkSchema, {
      especialidadIds: values.especialidadesCentro || v.especialidadIds,
      cargo: values.cargo || 'Planta',
    });
    return ds().transaction(ALL, (tx) => {
      const dup = tx.find(
        C.medicos,
        (m) => m.tipoDocumento === v.tipoDocumento && m.numeroDocumento.toUpperCase() === v.numeroDocumento,
      );
      if (dup)
        throw new AppError(
          'DUPLICADO',
          `Ya existe ${doctorName(dup)} con ese documento. Vincúlelo al centro en lugar de crear un registro nuevo.`,
          { medicoId: dup.id, fields: { numeroDocumento: 'Documento ya registrado.' } },
        );
      if (tx.find(C.medicos, (m) => m.registroProfesional.toUpperCase() === v.registroProfesional))
        throw new AppError('DUPLICADO', undefined, {
          fields: { registroProfesional: 'Registro profesional ya registrado.' },
        });
      for (const e of v.especialidadIds)
        if (!tx.get(C.especialidades, e)) throw new AppError('VALIDACION', 'Especialidad inexistente.');
      if (link.especialidadIds.some((e) => !v.especialidadIds.includes(e)))
        throw new AppError(
          'VALIDACION',
          'Las especialidades en el centro deben estar entre las del profesional.',
        );
      const m = tx.insert(
        C.medicos,
        {
          nombres: v.nombres,
          apellidos: v.apellidos,
          tipoDocumento: v.tipoDocumento,
          numeroDocumento: v.numeroDocumento,
          registroProfesional: v.registroProfesional,
          foto: null,
          especialidadIds: v.especialidadIds,
          telefono: v.telefono || null,
          email: v.email || null,
          activo: true,
        },
        ID_PREFIX.medicos,
      );
      tx.insert(
        C.medicoCentros,
        {
          medicoId: m.id,
          centroId,
          especialidadIds: link.especialidadIds,
          cargo: link.cargo,
          fechaInicio: today(),
          fechaFin: null,
          activo: true,
        },
        ID_PREFIX.medicoCentros,
      );
      return m;
    });
  },

  /** Vincula un médico existente al centro de trabajo (o reactiva el vínculo). RN-MED-01. */
  async linkToCenter(session, medicoId, values) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    const centroId = workCenter(session);
    const link = parse(linkSchema, values);
    return ds().transaction(ALL, (tx) => {
      const m = tx.get(C.medicos, medicoId);
      if (!m) throw new AppError('NO_ENCONTRADO');
      if (!m.activo)
        throw new AppError(
          'VALIDACION',
          'El profesional está desactivado en la red. Solicite su reactivación a la administración central.',
        );
      const missing = link.especialidadIds.filter((e) => !m.especialidadIds.includes(e));
      if (missing.length) tx.update(C.medicos, m.id, { especialidadIds: [...m.especialidadIds, ...missing] });
      const prev = tx.find(C.medicoCentros, (x) => x.medicoId === medicoId && x.centroId === centroId);
      if (prev) {
        if (prev.activo) throw new AppError('DUPLICADO', 'El profesional ya está vinculado a este centro.');
        return tx.update(C.medicoCentros, prev.id, {
          activo: true,
          especialidadIds: link.especialidadIds,
          cargo: link.cargo,
          fechaFin: null,
        });
      }
      return tx.insert(
        C.medicoCentros,
        {
          medicoId,
          centroId,
          especialidadIds: link.especialidadIds,
          cargo: link.cargo,
          fechaInicio: today(),
          fechaFin: null,
          activo: true,
        },
        ID_PREFIX.medicoCentros,
      );
    });
  },

  async updatePersonal(session, medicoId, values) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    const v = parse(doctorSchema, values);
    return ds().transaction(ALL, (tx) => {
      const m = tx.get(C.medicos, medicoId);
      if (!m) throw new AppError('NO_ENCONTRADO');
      if (
        !canEditPersonal(
          session,
          tx.filter(C.medicoCentros, (x) => x.medicoId === medicoId),
        )
      )
        throw new AppError('ACCESO_DENEGADO');
      if (
        tx.find(
          C.medicos,
          (x) =>
            x.id !== medicoId &&
            x.tipoDocumento === v.tipoDocumento &&
            x.numeroDocumento.toUpperCase() === v.numeroDocumento,
        )
      )
        throw new AppError('DUPLICADO', undefined, {
          fields: { numeroDocumento: 'Documento ya registrado.' },
        });
      if (
        tx.find(
          C.medicos,
          (x) => x.id !== medicoId && x.registroProfesional.toUpperCase() === v.registroProfesional,
        )
      )
        throw new AppError('DUPLICADO', undefined, {
          fields: { registroProfesional: 'Registro ya registrado.' },
        });
      const enUso = tx
        .all(C.medicoCentros)
        .filter((x) => x.medicoId === medicoId)
        .flatMap((x) => x.especialidadIds);
      const quitadas = [...new Set(enUso)].filter((e) => !v.especialidadIds.includes(e));
      if (quitadas.length)
        throw new AppError(
          'VALIDACION',
          'No puede quitar especialidades que ejerce en algún centro; quítelas primero del vínculo.',
          { fields: { especialidadIds: 'Especialidad en uso en un centro.' } },
        );
      return tx.update(C.medicos, medicoId, {
        nombres: v.nombres,
        apellidos: v.apellidos,
        tipoDocumento: v.tipoDocumento,
        numeroDocumento: v.numeroDocumento,
        registroProfesional: v.registroProfesional,
        especialidadIds: v.especialidadIds,
        telefono: v.telefono || null,
        email: v.email || null,
      });
    });
  },

  /** Edita el vínculo del centro; no se puede quitar una especialidad con horarios activos (RN-MED-04). */
  async updateLink(session, mcId, values) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    const link = parse(linkSchema, values);
    return ds().transaction(ALL, (tx) => {
      const mc = tx.get(C.medicoCentros, mcId);
      if (!mc) throw new AppError('NO_ENCONTRADO');
      assertCenterAccess(session, mc.centroId);
      const m = tx.get(C.medicos, mc.medicoId);
      if (link.especialidadIds.some((e) => !m.especialidadIds.includes(e)))
        throw new AppError('VALIDACION', 'Agregue primero la especialidad a los datos del profesional.');
      const usadas = tx
        .filter(C.horarios, (h) => h.medicoCentroId === mcId && h.activo)
        .map((h) => h.especialidadId);
      const quitadas = [...new Set(usadas)].filter((e) => !link.especialidadIds.includes(e));
      if (quitadas.length) {
        const n = quitadas.map((e) => tx.get(C.especialidades, e)?.nombre).join(', ');
        throw new AppError(
          'VALIDACION',
          `Tiene horarios activos de ${n}: desactívelos antes de quitar la especialidad.`,
          { fields: { especialidadIds: 'Especialidad con horarios activos.' } },
        );
      }
      return tx.update(C.medicoCentros, mcId, { especialidadIds: link.especialidadIds, cargo: link.cargo });
    });
  },

  /** Fichas futuras que quedarían sin profesional al desactivar (RN-MED-03). */
  linkImpact(session, mcId) {
    assertPermission(session, 'medicos.gestionar');
    const snap = ds().snapshot(ALL);
    const mc = snap.medicoCentros.find((x) => x.id === mcId);
    if (!mc) throw new AppError('NO_ENCONTRADO');
    assertCenterAccess(session, mc.centroId);
    return futureActive(snap.fichas, (f) => f.medicoId === mc.medicoId && f.centroId === mc.centroId).length;
  },

  /** Activa / desactiva el vínculo con el centro: no afecta otros centros (RN-MED-03). */
  async setLinkActive(session, mcId, activo) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    return ds().transaction(ALL, (tx) => {
      const mc = tx.get(C.medicoCentros, mcId);
      if (!mc) throw new AppError('NO_ENCONTRADO');
      assertCenterAccess(session, mc.centroId);
      return tx.update(C.medicoCentros, mcId, { activo, fechaFin: activo ? null : today() });
    });
  },

  /** Desactiva / reactiva al profesional en toda la red (solo administración central). */
  async setDoctorActive(session, medicoId, activo) {
    await delay();
    assertPermission(session, 'medicos.gestionar');
    if (session.rol !== 'admin_central')
      throw new AppError(
        'PERMISO_DENEGADO',
        'Solo la administración central desactiva profesionales en toda la red; desactive el vínculo con su centro.',
      );
    return ds().transaction(ALL, (tx) => {
      if (!tx.get(C.medicos, medicoId)) throw new AppError('NO_ENCONTRADO');
      return tx.update(C.medicos, medicoId, { activo });
    });
  },

  /** Opciones: especialidades del catálogo (activas). */
  catalogOptions() {
    return ds()
      .list(C.especialidades, { activo: true })
      .map((e) => ({ value: e.id, label: e.nombre }))
      .sort((a, b) => compareText(a.label, b.label));
  },
};
