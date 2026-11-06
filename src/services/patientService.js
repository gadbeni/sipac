/**
 * Pacientes en el panel (Épica 10, BUSINESS_RULES §8). Solo datos administrativos: no existe
 * ningún campo clínico. Visibilidad por centro (RN-PAC-03): un usuario de centro solo ve
 * pacientes con al menos una solicitud o ficha en su centro; el médico, los de sus fichas;
 * el admin central, todos.
 */
import { z } from 'zod';
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { assertPermission, can, scopeCenter } from './auth/guards';
import { canUnblock, isPatientBlocked, unblockPatient } from './rules/patientBlock';
import { doctorName } from './rules/portal';
import { userLabel } from './requestAdminService';
import { COLLECTIONS as C, TIPOS_DOCUMENTO } from '@/config/constants';
import { documentKey } from '@/utils/codes';
import { ageAt, isValidDate, nowIso, today } from '@/utils/dates';
import { normalizeText } from '@/utils/text';

const ds = () => getDataSource();
const ALL = Object.values(C);
const NAME = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;
export const CAMPOS = {
  tipoDocumento: 'Tipo de documento',
  numeroDocumento: 'Documento',
  complemento: 'Complemento',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  fechaNacimiento: 'Fecha de nacimiento',
  sexo: 'Sexo',
  telefono: 'Teléfono',
  verificado: 'Verificado',
};

export const patientEditSchema = z.object({
  tipoDocumento: z.enum(Object.keys(TIPOS_DOCUMENTO)),
  numeroDocumento: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,15}$/, 'Entre 5 y 15 letras o números.'),
  complemento: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{0,3}$/, 'Hasta 3 caracteres.')
    .transform((v) => v || null)
    .nullable()
    .optional(),
  nombres: z.string().trim().min(2, 'Ingrese los nombres.').max(60).regex(NAME, 'Solo letras.'),
  apellidos: z.string().trim().min(2, 'Ingrese los apellidos.').max(60).regex(NAME, 'Solo letras.'),
  fechaNacimiento: z
    .string()
    .refine((v) => isValidDate(v) && v <= today() && ageAt(v) <= 120, 'Fecha inválida.'),
  sexo: z
    .enum(['F', 'M', ''])
    .optional()
    .nullable()
    .transform((v) => v || null),
  telefono: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^\+?591/, ''))
    .pipe(z.string().regex(/^[2-7]\d{7}$/, '8 dígitos (celular o fijo).'))
    .transform((v) => `+591 ${v}`),
});

/** Alcance de la sesión: { centroId|null, medicoId|null }. */
function scopeOf(session) {
  assertPermission(session, 'pacientes.ver');
  const centroId = scopeCenter(session);
  return { centroId, medicoId: session.rol === 'medico' ? session.medicoId : null };
}

/** Ids de pacientes visibles en el alcance (null = todos). */
function visibleIds(snap, { centroId, medicoId }) {
  if (!centroId && !medicoId) return null;
  const ids = new Set();
  for (const f of snap.fichas)
    if ((!centroId || f.centroId === centroId) && (!medicoId || f.medicoId === medicoId))
      ids.add(f.pacienteId);
  if (!medicoId) for (const s of snap.solicitudes) if (s.centroId === centroId) ids.add(s.pacienteId);
  return ids;
}

function assertVisible(snap, scope, pacienteId) {
  const ids = visibleIds(snap, scope);
  if (ids && !ids.has(pacienteId))
    throw new AppError('ACCESO_DENEGADO', 'El paciente no tiene registros en su centro.');
}

const inScope = (x, { centroId, medicoId }) =>
  (!centroId || x.centroId === centroId) && (!medicoId || x.medicoId === medicoId);

export const patientService = {
  CAMPOS,

  async list(session, { q, filtro } = {}) {
    await delay();
    const scope = scopeOf(session);
    const snap = ds().snapshot(ALL);
    const ids = visibleIds(snap, scope);
    const query = normalizeText(q);
    const fichasBy = new Map();
    for (const f of snap.fichas)
      if (inScope(f, scope))
        (fichasBy.get(f.pacienteId) || fichasBy.set(f.pacienteId, []).get(f.pacienteId)).push(f);
    const pendVerif = new Set(
      snap.solicitudes
        .filter(
          (s) => s.datosPorVerificar && (!scope.centroId || s.centroId === scope.centroId) && !scope.medicoId,
        )
        .map((s) => s.pacienteId),
    );
    return snap.pacientes
      .filter((p) => !ids || ids.has(p.id))
      .filter(
        (p) =>
          !query ||
          normalizeText(`${p.numeroDocumento} ${p.nombres} ${p.apellidos} ${p.telefono}`).includes(query),
      )
      .map((p) => {
        const fs = (fichasBy.get(p.id) || []).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
        const atendidas = fs.filter((f) => f.estado === 'atendida');
        return {
          id: p.id,
          nombre: `${p.nombres} ${p.apellidos}`,
          documento: `${p.numeroDocumento}${p.complemento ? `-${p.complemento}` : ''}`,
          tipoDocumento: p.tipoDocumento,
          edad: ageAt(p.fechaNacimiento),
          telefono: p.telefono,
          verificado: Boolean(p.verificado),
          bloqueado: isPatientBlocked(p),
          porVerificar: pendVerif.has(p.id),
          fichas: fs.length,
          ausencias: fs.filter((f) => f.estado === 'ausente').length,
          ultimaAtencion: atendidas[0]?.fecha || null,
          proxima:
            fs
              .filter((f) => f.fecha >= today() && ['confirmada', 'en_espera', 'llamada'].includes(f.estado))
              .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0]?.fecha || null,
        };
      })
      .filter(
        (r) =>
          !filtro ||
          (filtro === 'bloqueados' && r.bloqueado) ||
          (filtro === 'porVerificar' && r.porVerificar) ||
          (filtro === 'noVerificados' && !r.verificado),
      )
      .sort(
        (a, b) =>
          Number(b.bloqueado) - Number(a.bloqueado) ||
          Number(b.porVerificar) - Number(a.porVerificar) ||
          a.nombre.localeCompare(b.nombre, 'es'),
      );
  },

  async getDetail(session, id) {
    await delay();
    const scope = scopeOf(session);
    const snap = ds().snapshot(ALL);
    const p = snap.pacientes.find((x) => x.id === id);
    if (!p) throw new AppError('NO_ENCONTRADO');
    assertVisible(snap, scope, id);
    const esp = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
    const cen = new Map(snap.centros.map((c) => [c.id, c.nombre]));
    const med = new Map(snap.medicos.map((m) => [m.id, m]));
    const cons = new Map(snap.consultorios.map((c) => [c.id, c.nombre]));
    const fichas = snap.fichas
      .filter((f) => f.pacienteId === id && inScope(f, scope))
      .map((f) => ({
        id: f.id,
        codigo: f.codigoVisible,
        fecha: f.fecha,
        hora: f.horaEstimada,
        estado: f.estado,
        canal: f.canal,
        especialidad: esp.get(f.especialidadId),
        medico: med.get(f.medicoId) ? doctorName(med.get(f.medicoId)) : '—',
        consultorio: cons.get(f.consultorioId),
        centro: cen.get(f.centroId),
        motivo: f.motivoEstado,
      }))
      .sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? 1 : -1));
    const solicitudes = scope.medicoId
      ? []
      : snap.solicitudes
          .filter((s) => s.pacienteId === id && (!scope.centroId || s.centroId === scope.centroId))
          .map((s) => ({
            id: s.id,
            codigo: s.codigo,
            fecha: s.fechaSolicitada,
            estado: s.estado,
            especialidad: esp.get(s.especialidadId),
            centro: cen.get(s.centroId),
            motivo: s.motivoEstado,
            creadoEn: s.creadoEn,
            datosPorVerificar: s.datosPorVerificar,
            datosIngresados: s.datosIngresados || null,
          }))
          .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
    return {
      ...p,
      nombre: `${p.nombres} ${p.apellidos}`,
      edad: ageAt(p.fechaNacimiento),
      bloqueado: isPatientBlocked(p),
      bloqueoCentro: p.bloqueo?.centroId ? cen.get(p.bloqueo.centroId) : null,
      bloqueoFicha: p.bloqueo?.fichaId
        ? snap.fichas.find((f) => f.id === p.bloqueo.fichaId)?.codigoVisible
        : null,
      puedeHabilitar: isPatientBlocked(p) && can(session, 'pacientes.habilitar') && canUnblock(session, p),
      puedeEditar: can(session, 'pacientes.editar'),
      historialBloqueos: (p.historialBloqueos || [])
        .map((h) => ({ ...h, usuario: userLabel(snap.usuarios, h.usuarioId), centro: cen.get(h.centroId) }))
        .reverse(),
      auditoria: (p.auditoria || [])
        .map((a) => ({ ...a, usuario: userLabel(snap.usuarios, a.usuarioId) }))
        .reverse(),
      fichas,
      solicitudes,
      porVerificar: solicitudes.filter((s) => s.datosPorVerificar),
      resumen: {
        fichas: fichas.length,
        atendidas: fichas.filter((f) => f.estado === 'atendida').length,
        ausencias: fichas.filter((f) => f.estado === 'ausente').length,
      },
    };
  },

  /** Edición con auditoría (quién, cuándo, qué cambió). Unicidad por documento (RN-PAC-02). */
  async update(session, id, values) {
    await delay();
    assertPermission(session, 'pacientes.editar');
    const scope = scopeOf(session);
    const r = patientEditSchema.safeParse(values);
    if (!r.success)
      throw new AppError('VALIDACION', undefined, {
        fields: Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message])),
      });
    const v = r.data;
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const snap = Object.fromEntries(ALL.map((c) => [c, tx.all(c)]));
      const p = tx.get(C.pacientes, id);
      if (!p) throw new AppError('NO_ENCONTRADO');
      assertVisible(snap, scope, id);
      if (tx.find(C.pacientes, (x) => x.id !== id && documentKey(x) === documentKey(v)))
        throw new AppError('DUPLICADO', 'Ya existe otro paciente con ese documento.', {
          fields: { numeroDocumento: 'Documento ya registrado.' },
        });
      const cambios = Object.keys(v)
        .filter((k) => String(p[k] ?? '') !== String(v[k] ?? ''))
        .map((k) => ({ campo: k, antes: p[k] ?? null, despues: v[k] ?? null }));
      if (!cambios.length) return p;
      return tx.update(C.pacientes, id, {
        ...v,
        auditoria: [
          ...(p.auditoria || []),
          { fecha: iso, usuarioId: session.usuarioId, accion: 'edicion', cambios },
        ],
      });
    });
  },

  /** Marcar documento verificado (presentó el documento físico). */
  async setVerified(session, id, verificado) {
    await delay(0);
    assertPermission(session, 'pacientes.editar');
    const scope = scopeOf(session);
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const p = tx.get(C.pacientes, id);
      if (!p) throw new AppError('NO_ENCONTRADO');
      assertVisible(Object.fromEntries(ALL.map((c) => [c, tx.all(c)])), scope, id);
      return tx.update(C.pacientes, id, {
        verificado,
        auditoria: [
          ...(p.auditoria || []),
          {
            fecha: iso,
            usuarioId: session.usuarioId,
            accion: 'verificacion',
            cambios: [{ campo: 'verificado', antes: Boolean(p.verificado), despues: verificado }],
          },
        ],
      });
    });
  },

  /** Habilitación manual (RN-PAC-07): rol y centro de la inasistencia + nota obligatoria. */
  async unblock(session, id, { nota }) {
    await delay();
    assertPermission(session, 'pacientes.habilitar');
    if (!nota?.trim() || nota.trim().length < 5)
      throw new AppError('VALIDACION', 'Escriba una nota que justifique la habilitación.', {
        fields: { nota: 'Requerida (mínimo 5 caracteres).' },
      });
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const p = tx.get(C.pacientes, id);
      if (!p) throw new AppError('NO_ENCONTRADO');
      if (!isPatientBlocked(p)) throw new AppError('VALIDACION', 'El paciente no está bloqueado.');
      if (!canUnblock(session, p))
        throw new AppError(
          'ACCESO_DENEGADO',
          'Solo la administración central o el centro donde ocurrió la inasistencia pueden habilitarlo.',
        );
      return tx.update(
        C.pacientes,
        id,
        unblockPatient(p, { fecha: iso, usuarioId: session.usuarioId, nota: nota.trim() }),
      );
    });
  },

  /**
   * Resuelve "datos por verificar" de una solicitud (RN-SOL-04):
   * 'aplicar' actualiza el registro con lo ingresado en el portal (queda en auditoría);
   * 'mantener' conserva el registro. En ambos casos se limpia la marca y se anota en el historial.
   */
  async resolveDataCheck(session, solicitudId, accion) {
    await delay();
    assertPermission(session, 'pacientes.editar');
    if (!['aplicar', 'mantener'].includes(accion)) throw new AppError('VALIDACION');
    const scope = scopeOf(session);
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const s = tx.get(C.solicitudes, solicitudId);
      if (!s || !s.datosPorVerificar)
        throw new AppError('NO_ENCONTRADO', 'La solicitud no tiene datos por verificar.');
      if (scope.centroId && s.centroId !== scope.centroId) throw new AppError('ACCESO_DENEGADO');
      const p = tx.get(C.pacientes, s.pacienteId);
      if (accion === 'aplicar' && s.datosIngresados) {
        const cambios = Object.entries(s.datosIngresados)
          .filter(([k, v]) => String(p[k] ?? '') !== String(v ?? ''))
          .map(([k, v]) => ({ campo: k, antes: p[k] ?? null, despues: v }));
        if (cambios.length)
          tx.update(C.pacientes, p.id, {
            ...s.datosIngresados,
            auditoria: [
              ...(p.auditoria || []),
              { fecha: iso, usuarioId: session.usuarioId, accion: `datos del portal (${s.codigo})`, cambios },
            ],
          });
      }
      return tx.update(C.solicitudes, s.id, {
        datosPorVerificar: false,
        historial: [
          ...(s.historial || []),
          {
            estado: s.estado,
            fecha: iso,
            usuarioId: session.usuarioId,
            nota:
              accion === 'aplicar'
                ? 'Datos verificados: se actualizó el registro del paciente con lo ingresado en el portal.'
                : 'Datos verificados: se conservó el registro existente del paciente.',
          },
        ],
      });
    });
  },
};
