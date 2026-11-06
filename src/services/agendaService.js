/**
 * Horarios, excepciones (novedades de agenda) y vistas de agenda (Épica 9, BUSINESS_RULES §5).
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { assertCenterAccess, assertPermission, can, scopeCenter } from './auth/guards';
import { affectedByException, buildAgenda, validateSchedule } from './rules/agenda';
import { computeBlock, buildOccupancyIndex, getDayBlocks } from './rules/availability';
import { cancelTicket, moveTicket } from './rules/tickets';
import { doctorName } from './rules/portal';
import { COLLECTIONS as C, ID_PREFIX, TIPOS_EXCEPCION } from '@/config/constants';
import { addDays, currentTime, diffDays, nowIso, timeToMinutes, today } from '@/utils/dates';
import { compareText } from '@/utils/text';

const ds = () => getDataSource();
const ALL = Object.values(C);
const now = () => ({ date: today(), time: currentTime() });
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function workCenter(session) {
  const c = scopeCenter(session);
  if (!c) throw new AppError('VALIDACION', 'Elija un centro de trabajo en la barra superior.');
  return c;
}

const toNum = (v) => (v === '' || v == null ? NaN : Number(v));

function normalizeSchedule(values, centroId, snap) {
  const mc = snap.medicoCentros.find((x) => x.id === values.medicoCentroId);
  return {
    centroId,
    medicoCentroId: values.medicoCentroId,
    medicoId: mc?.medicoId,
    especialidadId: values.especialidadId,
    consultorioId: values.consultorioId,
    diaSemana: Number(values.diaSemana),
    horaInicio: values.horaInicio,
    horaFin: values.horaFin,
    duracionConsultaMin: toNum(values.duracionConsultaMin),
    cupos: toNum(values.cupos),
    cuposPublicos: toNum(values.cuposPublicos),
    vigenciaDesde: values.vigenciaDesde || today(),
    vigenciaHasta: values.vigenciaHasta || null,
    activo: values.activo !== false,
  };
}

function checkSchedule(snap, h, { excludeId, confirmar }) {
  const { fields, warnings } = validateSchedule(snap, h, { excludeId, today: today() });
  if (Object.keys(fields).length) throw new AppError('VALIDACION', Object.values(fields)[0], { fields });
  if (warnings.length && !confirmar) throw new AppError('ADVERTENCIAS', warnings.join(' '), { warnings });
}

/** Excepción en la forma del modelo, validada (RN-AGE-01). */
function normalizeException(session, centroId, v, snap) {
  const fields = {};
  if (!TIPOS_EXCEPCION[v.tipo]) fields.tipo = 'Seleccione el tipo.';
  if (!DATE.test(v.fechaInicio || '')) fields.fechaInicio = 'Fecha inválida.';
  if (!DATE.test(v.fechaFin || '')) fields.fechaFin = 'Fecha inválida.';
  if (!fields.fechaInicio && v.fechaInicio < today())
    fields.fechaInicio = 'No se registran novedades en fechas pasadas.';
  if (!fields.fechaFin && !fields.fechaInicio && v.fechaFin < v.fechaInicio)
    fields.fechaFin = 'Debe ser igual o posterior al inicio.';
  if (!fields.fechaFin && !fields.fechaInicio && diffDays(v.fechaInicio, v.fechaFin) > 90)
    fields.fechaFin = 'Máximo 90 días por novedad.';
  const parcial = Boolean(v.horaInicio || v.horaFin);
  if (parcial && (!HHMM.test(v.horaInicio || '') || !HHMM.test(v.horaFin || '') || v.horaFin <= v.horaInicio))
    fields.horaFin = 'Indique una franja válida o deje ambas horas vacías (día completo).';
  if (!v.motivo?.trim()) fields.motivo = 'Indique el motivo.';
  const alcance = v.alcance;
  const exc = {
    tipo: v.tipo,
    alcance,
    centroId,
    medicoId: null,
    especialidadId: null,
    horarioId: null,
    horaInicio: parcial ? v.horaInicio : null,
    horaFin: parcial ? v.horaFin : null,
    cuposAjustados: null,
    fechaInicio: v.fechaInicio,
    fechaFin: v.fechaFin,
    motivo: v.motivo?.trim(),
    creadoPor: session.usuarioId,
  };
  if (alcance === 'global') {
    if (session.rol !== 'admin_central')
      fields.alcance = 'Solo la administración central registra novedades para toda la red.';
    if (!['feriado', 'bloqueo'].includes(v.tipo))
      fields.tipo = 'Para toda la red solo se registran feriados o bloqueos.';
    exc.centroId = null;
  } else if (alcance === 'centro') {
    if (!['feriado', 'bloqueo'].includes(v.tipo)) fields.tipo = 'Para todo el centro use feriado o bloqueo.';
  } else if (alcance === 'especialidad') {
    if (
      !snap.centroEspecialidades.some((x) => x.centroId === centroId && x.especialidadId === v.especialidadId)
    )
      fields.especialidadId = 'Seleccione una especialidad del centro.';
    exc.especialidadId = v.especialidadId;
  } else if (alcance === 'medico') {
    if (!snap.medicoCentros.some((x) => x.centroId === centroId && x.medicoId === v.medicoId))
      fields.medicoId = 'Seleccione un profesional del centro.';
    exc.medicoId = v.medicoId;
    // RN-MC-04: ausencia de alcance global del médico (todos sus centros) solo por el admin central.
    if (v.todosLosCentros) {
      if (session.rol !== 'admin_central' || v.tipo !== 'ausencia')
        fields.alcance =
          'Solo la administración central registra ausencias para todos los centros del profesional.';
      exc.centroId = null;
    }
  } else if (alcance === 'horario') {
    const h = snap.horarios.find((x) => x.id === v.horarioId);
    if (!h || h.centroId !== centroId) fields.horarioId = 'Seleccione un horario del centro.';
    exc.horarioId = v.horarioId;
  } else fields.alcance = 'Seleccione el alcance.';
  if (v.tipo === 'ajuste_cupos') {
    if (alcance !== 'horario' && alcance !== 'medico')
      fields.alcance = 'El ajuste de cupos se aplica a un horario o a un profesional.';
    const n = toNum(v.cuposAjustados);
    if (!Number.isInteger(n) || n < 0 || n > 60) fields.cuposAjustados = 'Entre 0 y 60.';
    exc.cuposAjustados = n;
  }
  if (Object.keys(fields).length) throw new AppError('VALIDACION', Object.values(fields)[0], { fields });
  return exc;
}

const MOTIVO_CANCEL = {
  feriado: 'Feriado o bloqueo de agenda',
  bloqueo: 'Feriado o bloqueo de agenda',
  ausencia: 'Ausencia del profesional',
  permiso: 'Ausencia del profesional',
  ajuste_cupos: 'Feriado o bloqueo de agenda',
};

function ticketView(snap, f) {
  const p = snap.pacientes.find((x) => x.id === f.pacienteId);
  const m = snap.medicos.find((x) => x.id === f.medicoId);
  return {
    id: f.id,
    codigo: f.codigoVisible,
    fecha: f.fecha,
    hora: f.horaEstimada,
    estado: f.estado,
    canal: f.canal,
    paciente: p ? `${p.nombres} ${p.apellidos}` : '—',
    medico: m ? doctorName(m) : '—',
    centroId: f.centroId,
  };
}

/** Mejor destino para reprogramar: mismo centro y especialidad, hasta 14 días, con cupo del canal. */
function findTarget(tx, f, n) {
  const snap = Object.fromEntries(
    [
      'centros',
      'centroEspecialidades',
      'especialidades',
      'horarios',
      'medicos',
      'medicoCentros',
      'excepcionesAgenda',
      'fichas',
      'solicitudes',
    ].map((k) => [k, tx.all(k)]),
  );
  const occupancy = buildOccupancyIndex(snap.fichas);
  const desde = f.fecha < n.date ? n.date : f.fecha;
  for (let i = 0; i <= 14; i++) {
    const fecha = addDays(desde, i);
    const blocks = getDayBlocks(snap, {
      centroId: f.centroId,
      especialidadId: f.especialidadId,
      fecha,
      incluirBloqueados: false,
      index: { occupancy, pending: new Map() },
    })
      .filter((b) => fecha > n.date || timeToMinutes(n.time) < timeToMinutes(b.horaFin))
      .filter((b) => (f.canal === 'web' ? b.publicosLibres > 0 : b.libres > 0))
      .sort(
        (a, b) =>
          (b.medicoId === f.medicoId) - (a.medicoId === f.medicoId) ||
          timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio),
      );
    if (blocks.length) return { horarioId: blocks[0].horarioId, fecha };
  }
  return null;
}

export const agendaService = {
  // ------------------------------------------------------------------ Horarios
  async listSchedules(session, { medicoId, especialidadId, incluirInactivos = true } = {}) {
    await delay();
    assertPermission(session, ['horarios.gestionar', 'agenda.ver']);
    const centroId = workCenter(session);
    const snap = ds().snapshot(ALL);
    const esps = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
    const cons = new Map(snap.consultorios.map((x) => [x.id, x.nombre]));
    return snap.horarios
      .filter(
        (h) =>
          h.centroId === centroId &&
          (!medicoId || h.medicoId === medicoId) &&
          (!especialidadId || h.especialidadId === especialidadId) &&
          (incluirInactivos || h.activo),
      )
      .map((h) => ({
        ...h,
        medico: doctorName(snap.medicos.find((m) => m.id === h.medicoId)),
        especialidad: esps.get(h.especialidadId),
        consultorio: cons.get(h.consultorioId),
        fichasFuturas: snap.fichas.filter(
          (f) =>
            f.horarioId === h.id &&
            f.fecha >= today() &&
            ['confirmada', 'en_espera', 'llamada'].includes(f.estado),
        ).length,
      }))
      .sort(
        (a, b) =>
          a.diaSemana - b.diaSemana ||
          a.horaInicio.localeCompare(b.horaInicio) ||
          compareText(a.medico, b.medico),
      );
  },

  /** Opciones del formulario: vínculos activos (con especialidades) y consultorios del centro. */
  scheduleOptions(session) {
    assertPermission(session, ['horarios.gestionar', 'agenda.gestionar']);
    const centroId = workCenter(session);
    const snap = ds().snapshot(ALL);
    const esps = new Map(snap.especialidades.map((e) => [e.id, e]));
    return {
      vinculos: snap.medicoCentros
        .filter(
          (mc) =>
            mc.centroId === centroId && mc.activo && snap.medicos.find((m) => m.id === mc.medicoId)?.activo,
        )
        .map((mc) => ({
          value: mc.id,
          medicoId: mc.medicoId,
          label: doctorName(snap.medicos.find((m) => m.id === mc.medicoId)),
          especialidades: mc.especialidadIds.map((e) => ({ value: e, label: esps.get(e)?.nombre })),
        }))
        .sort((a, b) => compareText(a.label, b.label)),
      consultorios: snap.consultorios
        .filter((x) => x.centroId === centroId && x.activo)
        .map((x) => ({ value: x.id, label: x.nombre })),
      especialidades: snap.centroEspecialidades
        .filter((x) => x.centroId === centroId && x.activo)
        .map((x) => ({ value: x.especialidadId, label: esps.get(x.especialidadId)?.nombre }))
        .sort((a, b) => compareText(a.label, b.label)),
      horarios: snap.horarios
        .filter((h) => h.centroId === centroId && h.activo)
        .map((h) => ({
          value: h.id,
          label: `${['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][h.diaSemana]} ${h.horaInicio}–${h.horaFin} · ${doctorName(snap.medicos.find((m) => m.id === h.medicoId))} · ${esps.get(h.especialidadId)?.nombre}`,
        })),
    };
  },

  async createSchedule(session, values, { confirmar = false } = {}) {
    await delay();
    assertPermission(session, 'horarios.gestionar');
    const centroId = workCenter(session);
    return ds().transaction(ALL, (tx) => {
      const snap = Object.fromEntries(ALL.map((c) => [c, tx.all(c)]));
      const h = normalizeSchedule(values, centroId, snap);
      checkSchedule(snap, h, { confirmar });
      return tx.insert(C.horarios, h, ID_PREFIX.horarios);
    });
  },

  async updateSchedule(session, id, values, { confirmar = false } = {}) {
    await delay();
    assertPermission(session, 'horarios.gestionar');
    return ds().transaction(ALL, (tx) => {
      const prev = tx.get(C.horarios, id);
      if (!prev) throw new AppError('NO_ENCONTRADO');
      assertCenterAccess(session, prev.centroId);
      const snap = Object.fromEntries(ALL.map((c) => [c, tx.all(c)]));
      const h = normalizeSchedule({ ...prev, ...values }, prev.centroId, snap);
      checkSchedule(snap, h, { excludeId: id, confirmar });
      return tx.update(C.horarios, id, h);
    });
  },

  async setScheduleActive(session, id, activo, { confirmar = false } = {}) {
    const prev = ds().get(C.horarios, id);
    if (!prev) throw new AppError('NO_ENCONTRADO');
    return this.updateSchedule(session, id, { activo }, { confirmar });
  },

  // ------------------------------------------------------------------ Agenda
  /** Agenda del rango (máx. 42 días). El médico ve solo sus bloques. */
  async getAgenda(session, { desde, hasta, medicoId, especialidadId, conFichas = false }) {
    await delay();
    assertPermission(session, 'agenda.ver');
    const centroId = workCenter(session);
    if (diffDays(desde, hasta) > 42 || hasta < desde)
      throw new AppError('VALIDACION', 'Rango de fechas inválido.');
    const med = session.rol === 'medico' ? session.medicoId : medicoId;
    const snap = ds().snapshot(ALL);
    const days = buildAgenda(snap, {
      centroId,
      desde,
      hasta,
      medicoId: med || undefined,
      especialidadId: especialidadId || undefined,
    });
    if (conFichas) {
      for (const d of days)
        for (const b of d.bloques) {
          b.fichas = snap.fichas
            .filter(
              (f) =>
                f.horarioId === b.horarioId &&
                f.fecha === d.fecha &&
                !['cancelada', 'reprogramada'].includes(f.estado),
            )
            .sort((x, y) => x.slot - y.slot)
            .map((f) => ({ ...ticketView(snap, f), slot: f.slot, prioridad: f.prioridad }));
        }
    }
    return days;
  },

  filterOptions(session) {
    assertPermission(session, 'agenda.ver');
    const centroId = workCenter(session);
    const snap = ds().snapshot([C.medicos, C.medicoCentros, C.especialidades, C.centroEspecialidades]);
    return {
      medicos: snap.medicoCentros
        .filter((x) => x.centroId === centroId)
        .map((x) => ({ value: x.medicoId, label: doctorName(snap.medicos.find((m) => m.id === x.medicoId)) }))
        .sort((a, b) => compareText(a.label, b.label)),
      especialidades: snap.centroEspecialidades
        .filter((x) => x.centroId === centroId && x.activo)
        .map((x) => ({
          value: x.especialidadId,
          label: snap.especialidades.find((e) => e.id === x.especialidadId)?.nombre,
        }))
        .sort((a, b) => compareText(a.label, b.label)),
    };
  },

  // ------------------------------------------------------------------ Excepciones (novedades)
  async listExceptions(session, { desde } = {}) {
    await delay();
    assertPermission(session, 'agenda.ver');
    const centroId = workCenter(session);
    const snap = ds().snapshot(ALL);
    const d = desde || today();
    const meds = new Set(snap.medicoCentros.filter((x) => x.centroId === centroId).map((x) => x.medicoId));
    return snap.excepcionesAgenda
      .filter(
        (e) =>
          e.fechaFin >= d &&
          (e.centroId === centroId ||
            (e.centroId == null && (e.alcance === 'global' || meds.has(e.medicoId)))),
      )
      .map((e) => {
        const h = e.horarioId ? snap.horarios.find((x) => x.id === e.horarioId) : null;
        const m = e.medicoId
          ? snap.medicos.find((x) => x.id === e.medicoId)
          : h
            ? snap.medicos.find((x) => x.id === h.medicoId)
            : null;
        const esp = e.especialidadId
          ? snap.especialidades.find((x) => x.id === e.especialidadId)
          : h
            ? snap.especialidades.find((x) => x.id === h.especialidadId)
            : null;
        const alcanceLabel = {
          global: 'Toda la red',
          centro: 'Todo el centro',
          especialidad: esp?.nombre,
          medico: `${m ? doctorName(m) : ''}${e.centroId == null ? ' (todos sus centros)' : ''}`,
          horario: h ? `${m ? doctorName(m) : ''} · ${h.horaInicio}–${h.horaFin}` : 'Horario',
        }[e.alcance];
        const creador = snap.usuarios.find((u) => u.id === e.creadoPor);
        return {
          ...e,
          tipoLabel: TIPOS_EXCEPCION[e.tipo],
          alcanceLabel,
          creador: creador?.nombre || e.creadoPor,
          editable:
            e.centroId === centroId ? can(session, 'agenda.gestionar') : session.rol === 'admin_central',
        };
      })
      .sort((a, b) => (a.fechaInicio < b.fechaInicio ? -1 : 1));
  },

  /** Simula la novedad: fichas afectadas y, para "reprogramar", el destino propuesto de cada una. */
  async previewException(session, values) {
    await delay(0);
    assertPermission(session, 'agenda.gestionar');
    const centroId = workCenter(session);
    const snap = ds().snapshot(ALL);
    const exc = normalizeException(session, centroId, values, snap);
    const afectadas = affectedByException(snap, exc, { today: today() }).map((f) => ticketView(snap, f));
    return { excepcion: exc, afectadas, centros: [...new Set(afectadas.map((a) => a.centroId))] };
  },

  /**
   * Registra la novedad (RN-AGE-01/02). Si hay fichas afectadas exige `resolucion`:
   * 'reprogramar' (a la primera fecha con cupo; si no hay, se cancela) o 'cancelar'.
   */
  async createException(session, values, { resolucion } = {}) {
    await delay();
    assertPermission(session, 'agenda.gestionar');
    const centroId = workCenter(session);
    const iso = nowIso();
    const n = now();
    return ds().transaction(ALL, (tx) => {
      const snap = Object.fromEntries(ALL.map((c) => [c, tx.all(c)]));
      const exc = normalizeException(session, centroId, values, snap);
      const afectadas = affectedByException(snap, exc, { today: n.date });
      if (afectadas.length && !['reprogramar', 'cancelar'].includes(resolucion)) {
        throw new AppError(
          'VALIDACION',
          `La novedad afecta ${afectadas.length} fichas emitidas: elija reprogramarlas o cancelarlas (RN-AGE-02).`,
          { afectadas: afectadas.length },
        );
      }
      const created = tx.insert(C.excepcionesAgenda, exc, ID_PREFIX.excepcionesAgenda);
      const report = { excepcion: created, reprogramadas: [], canceladas: [] };
      const motivo = `${MOTIVO_CANCEL[exc.tipo]}: ${exc.motivo}`;
      for (const f of afectadas.sort((a, b) =>
        a.fecha + a.horaEstimada < b.fecha + b.horaEstimada ? -1 : 1,
      )) {
        const fresh = tx.get(C.fichas, f.id);
        const target = resolucion === 'reprogramar' ? findTarget(tx, fresh, n) : null;
        if (target) {
          try {
            const nueva = moveTicket(tx, fresh, {
              ...target,
              usuarioId: session.usuarioId,
              now: n,
              iso,
              nota: `Reprogramada por novedad de agenda (${TIPOS_EXCEPCION[exc.tipo]})`,
            });
            report.reprogramadas.push({
              de: fresh.codigoVisible,
              a: nueva.codigoVisible,
              fecha: nueva.fecha,
              hora: nueva.horaEstimada,
            });
            continue;
          } catch {
            /* sin lugar al emitir: se cancela abajo */
          }
        }
        cancelTicket(tx, fresh, {
          usuarioId: session.usuarioId,
          iso,
          motivo: resolucion === 'reprogramar' ? `${motivo} (sin cupo para reprogramar)` : motivo,
        });
        report.canceladas.push({ codigo: fresh.codigoVisible, fecha: fresh.fecha });
      }
      if (report.reprogramadas.length || report.canceladas.length) {
        tx.insert(
          C.notificaciones,
          {
            centroId: exc.centroId,
            destinoUsuarioId: null,
            destinoRoles: ['admin_centro', 'recepcionista'],
            tipo: 'novedad_agenda',
            titulo: `Novedad de agenda: ${TIPOS_EXCEPCION[exc.tipo]}`,
            mensaje: `${exc.motivo}. ${report.reprogramadas.length} fichas reprogramadas, ${report.canceladas.length} canceladas. Avise a los pacientes.`,
            enlace: '/admin/horarios?tab=novedades',
            leidaPor: [],
          },
          ID_PREFIX.notificaciones,
        );
      }
      return report;
    });
  },

  /** Elimina una novedad: la disponibilidad vuelve; las fichas ya movidas o canceladas no se restauran. */
  async deleteException(session, id) {
    await delay();
    assertPermission(session, 'agenda.gestionar');
    return ds().transaction(ALL, (tx) => {
      const e = tx.get(C.excepcionesAgenda, id);
      if (!e) throw new AppError('NO_ENCONTRADO');
      if (e.centroId) assertCenterAccess(session, e.centroId);
      else if (session.rol !== 'admin_central')
        throw new AppError(
          'PERMISO_DENEGADO',
          'Las novedades de toda la red las gestiona la administración central.',
        );
      if (e.fechaFin < today())
        throw new AppError('VALIDACION', 'No se eliminan novedades pasadas (forman parte del historial).');
      tx.remove(C.excepcionesAgenda, id);
      return true;
    });
  },

  /** Ocupación de un bloque (para pruebas). */
  block(horarioId, fecha) {
    const snap = ds().snapshot(ALL);
    const h = snap.horarios.find((x) => x.id === horarioId);
    return computeBlock(snap, h, fecha, { occupancy: buildOccupancyIndex(snap.fichas), pending: new Map() });
  },
};
