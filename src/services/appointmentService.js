/**
 * Fichas del día y sala de espera (Épica 8, flujos F4/F5; BUSINESS_RULES §7).
 * Recepción: `fichas.entregar` (llegada, cancelar, reprogramar, cierre) y `fichas.emitir`
 * (ventanilla). Llamado: `llamado.controlar`; el médico solo sobre sus fichas (RN-FIC-09).
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { assertCenterAccess, assertPermission, scopeCenter } from './auth/guards';
import { getDayBlocks } from './rules/availability';
import { blockPatient, isPatientBlocked, unblockPatient } from './rules/patientBlock';
import { nextState } from './rules/stateMachines';
import { issueTicket, MAX_REPROGRAMACIONES, notifyFreedSlot, rescheduleCount } from './rules/tickets';
import { findPatientByDocument } from './rules/requests';
import { patientSchema } from './schemas/requestSchema';
import { doctorName } from './rules/portal';
import { COLLECTIONS as C, ID_PREFIX, LIMITES, MOTIVOS_CANCELACION } from '@/config/constants';
import { addDays, currentTime, nowIso, timeToMinutes, today } from '@/utils/dates';
import { normalizeText } from '@/utils/text';

const ds = () => getDataSource();
const ALL = Object.values(C);
const now = () => ({ date: today(), time: currentTime() });
const PRIO = { preferente: 0, normal: 1 };

/** Centro sobre el que opera recepción: debe ser uno concreto (no "todos"). */
function workCenter(session) {
  const c = scopeCenter(session);
  if (!c)
    throw new AppError(
      'VALIDACION',
      'Elija un centro de trabajo en la barra superior para operar la entrega de fichas.',
    );
  return c;
}

function loadFicha(tx, session, id) {
  const f = tx.get(C.fichas, id);
  if (!f) throw new AppError('NO_ENCONTRADO');
  assertCenterAccess(session, f.centroId);
  if (session.rol === 'medico' && f.medicoId !== session.medicoId)
    throw new AppError('ACCESO_DENEGADO', 'Solo puede operar sus propias fichas.');
  return f;
}

function viewOf(f, maps) {
  const p = maps.pac.get(f.pacienteId);
  return {
    ...f,
    paciente: p ? `${p.nombres} ${p.apellidos}` : '—',
    documento: p ? `${p.numeroDocumento}${p.complemento ? `-${p.complemento}` : ''}` : '',
    pacienteVerificado: Boolean(p?.verificado),
    pacienteBloqueado: Boolean(p?.bloqueo?.activo),
    especialidad: maps.esp.get(f.especialidadId)?.nombre,
    medico: maps.med.get(f.medicoId) ? doctorName(maps.med.get(f.medicoId)) : '—',
    consultorio: maps.con.get(f.consultorioId)?.nombre || '—',
    solicitudCodigo: f.solicitudId ? maps.sol.get(f.solicitudId)?.codigo : null,
  };
}

const mapsOf = (snap) => ({
  pac: new Map(snap.pacientes.map((x) => [x.id, x])),
  esp: new Map(snap.especialidades.map((x) => [x.id, x])),
  med: new Map(snap.medicos.map((x) => [x.id, x])),
  con: new Map(snap.consultorios.map((x) => [x.id, x])),
  sol: new Map(snap.solicitudes.map((x) => [x.id, x])),
});

/** Orden de la sala de espera (RN-FIC-03): preferente primero, luego número. */
export const queueOrder = (a, b) => PRIO[a.prioridad] - PRIO[b.prioridad] || a.numero - b.numero;

function transition(tx, f, action, patch, iso, nota) {
  const estado = nextState('ficha', f.estado, action);
  return tx.update(C.fichas, f.id, {
    estado,
    ...patch,
    ...(nota ? { motivoEstado: nota } : {}),
    actualizadoEn: iso,
  });
}

function syncSolicitudCancel(tx, f, usuarioId, texto, iso) {
  if (!f.solicitudId) return;
  const s = tx.get(C.solicitudes, f.solicitudId);
  if (s && s.estado === 'aprobada' && s.fichaId === f.id) {
    tx.update(C.solicitudes, s.id, {
      estado: 'cancelada',
      motivoEstado: texto,
      historial: [
        ...(s.historial || []),
        { estado: 'cancelada', fecha: iso, usuarioId, nota: `Ficha ${f.codigoVisible} cancelada: ${texto}` },
      ],
    });
  }
}

export const appointmentService = {
  queueOrder,

  /** Fichas del día del centro de trabajo, con datos del paciente. */
  async listDay(session, { fecha } = {}) {
    await delay();
    assertPermission(session, ['fichas.entregar', 'llamado.controlar']);
    const centroId = workCenter(session);
    const d = fecha || today();
    const snap = ds().snapshot(ALL);
    const maps = mapsOf(snap);
    return snap.fichas
      .filter(
        (f) =>
          f.centroId === centroId &&
          f.fecha === d &&
          (session.rol !== 'medico' || f.medicoId === session.medicoId),
      )
      .map((f) => viewOf(f, maps))
      .sort((a, b) => timeToMinutes(a.horaEstimada) - timeToMinutes(b.horaEstimada) || a.numero - b.numero);
  },

  /** Búsqueda rápida por código de solicitud, número de ficha, documento o nombre (hoy). */
  async search(session, q) {
    await delay(0);
    assertPermission(session, 'fichas.entregar');
    const centroId = workCenter(session);
    const query = normalizeText(q);
    if (query.length < 2) return { fichas: [], solicitudes: [], pacientes: [] };
    const snap = ds().snapshot(ALL);
    const maps = mapsOf(snap);
    const d = today();
    const match = (txt) => normalizeText(txt).includes(query);
    const fichas = snap.fichas
      .filter((f) => f.centroId === centroId && f.fecha === d)
      .map((f) => viewOf(f, maps))
      .filter((f) => match(`${f.codigoVisible} ${f.solicitudCodigo || ''} ${f.documento} ${f.paciente}`));
    const solicitudes = snap.solicitudes
      .filter(
        (s) =>
          s.centroId === centroId &&
          ['pendiente', 'lista_espera'].includes(s.estado) &&
          s.fechaSolicitada === d,
      )
      .filter((s) => {
        const p = maps.pac.get(s.pacienteId);
        return match(`${s.codigo} ${p?.numeroDocumento} ${p?.nombres} ${p?.apellidos}`);
      })
      .map((s) => ({
        id: s.id,
        codigo: s.codigo,
        estado: s.estado,
        especialidad: maps.esp.get(s.especialidadId)?.nombre,
        paciente: `${maps.pac.get(s.pacienteId)?.nombres} ${maps.pac.get(s.pacienteId)?.apellidos}`,
      }));
    return { fichas, solicitudes };
  },

  /** Busca un paciente por documento (ficha de ventanilla). */
  findPatient(session, doc) {
    assertPermission(session, 'fichas.emitir');
    const p = findPatientByDocument(ds().list(C.pacientes), doc);
    return p ? { ...p, bloqueado: isPatientBlocked(p) } : null;
  },

  /** Registrar llegada (RN-FIC-02): solo el día de la ficha. */
  async checkIn(session, fichaId, { verificar = false, prioridad } = {}) {
    await delay();
    assertPermission(session, 'fichas.entregar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const f = loadFicha(tx, session, fichaId);
      if (f.fecha !== today())
        throw new AppError('VALIDACION', 'Solo se registra la llegada el día de la ficha.');
      if (verificar) tx.update(C.pacientes, f.pacienteId, { verificado: true });
      return transition(
        tx,
        f,
        'registrar_llegada',
        { llegadaEn: iso, ...(prioridad ? { prioridad } : {}) },
        iso,
      );
    });
  },

  async setPriority(session, fichaId, prioridad) {
    await delay(0);
    assertPermission(session, 'fichas.entregar');
    if (!['normal', 'preferente'].includes(prioridad)) throw new AppError('VALIDACION');
    return ds().transaction(ALL, (tx) => {
      const f = loadFicha(tx, session, fichaId);
      return tx.update(C.fichas, f.id, { prioridad });
    });
  },

  /** Bloques de hoy con cupos para ventanilla (todos los cupos, RN-APR-07). */
  walkInOptions(session, especialidadId) {
    assertPermission(session, 'fichas.emitir');
    const centroId = workCenter(session);
    const n = now();
    const snap = ds().snapshot(ALL);
    const maps = mapsOf(snap);
    const ces = snap.centroEspecialidades.filter((x) => x.centroId === centroId && x.activo);
    const especialidades = ces
      .map((x) => ({ value: x.especialidadId, label: maps.esp.get(x.especialidadId)?.nombre }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    const bloques = especialidadId
      ? getDayBlocks(snap, { centroId, especialidadId, fecha: n.date, incluirBloqueados: false })
          .filter((b) => timeToMinutes(n.time) < timeToMinutes(b.horaFin))
          .map((b) => ({
            horarioId: b.horarioId,
            medico: doctorName(maps.med.get(b.medicoId)),
            consultorio: maps.con.get(b.consultorioId)?.nombre,
            horaInicio: b.horaInicio,
            horaFin: b.horaFin,
            libres: b.libres,
            cupos: b.cuposEfectivos,
          }))
      : [];
    return { especialidades, bloques };
  },

  /**
   * Ficha de ventanilla para un paciente presente (RN-APR-07): canal `ventanilla`, sin solicitud,
   * usa cupos totales. Si el paciente no existe se registra (verificado, documento presentado).
   */
  async issueWalkIn(session, { paciente, horarioId, prioridad = 'normal', registrarLlegada = true }) {
    await delay();
    assertPermission(session, 'fichas.emitir');
    const centroId = workCenter(session);
    const parsed = patientSchema.safeParse({ ...paciente, acepta: true });
    if (!parsed.success)
      throw new AppError('VALIDACION', undefined, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
      });
    const v = parsed.data;
    const iso = nowIso();
    const n = now();
    return ds().transaction(ALL, (tx) => {
      const h = tx.get(C.horarios, horarioId);
      if (!h || h.centroId !== centroId)
        throw new AppError('VALIDACION', 'Elija un bloque de atención del centro.');
      let p = findPatientByDocument(tx.all(C.pacientes), v);
      if (!p) {
        p = tx.insert(
          C.pacientes,
          {
            tipoDocumento: v.tipoDocumento,
            numeroDocumento: v.numeroDocumento,
            complemento: v.complemento ?? null,
            nombres: v.nombres,
            apellidos: v.apellidos,
            fechaNacimiento: v.fechaNacimiento,
            sexo: v.sexo,
            telefono: v.telefono,
            verificado: true,
            bloqueo: { activo: false, motivo: null, fichaId: null, centroId: null, desde: null },
            historialBloqueos: [],
            origen: 'ventanilla',
          },
          ID_PREFIX.pacientes,
        );
      }
      const f = issueTicket(tx, {
        horarioId,
        fecha: n.date,
        pacienteId: p.id,
        canal: 'ventanilla',
        prioridad,
        usuarioId: session.usuarioId,
        now: n,
        iso,
      });
      if (registrarLlegada) return tx.update(C.fichas, f.id, { estado: 'en_espera', llegadaEn: iso });
      return f;
    });
  },

  /** Cancelar ficha (RN-FIC-07): motivo obligatorio, libera cupo y avisa a lista de espera. */
  async cancel(session, fichaId, { motivo, detalle } = {}) {
    await delay();
    assertPermission(session, 'fichas.entregar');
    if (!motivo || !MOTIVOS_CANCELACION.includes(motivo))
      throw new AppError('VALIDACION', 'Seleccione el motivo de la cancelación.', {
        fields: { motivo: 'Requerido.' },
      });
    const texto = detalle?.trim() ? `${motivo}: ${detalle.trim()}` : motivo;
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const f = loadFicha(tx, session, fichaId);
      const upd = transition(tx, f, 'cancelar', { canceladaEn: iso }, iso, texto);
      syncSolicitudCancel(tx, f, session.usuarioId, texto, iso);
      notifyFreedSlot(tx, f, { motivo: 'Cancelación' });
      return upd;
    });
  },

  /** Opciones de reprogramación: bloques de la especialidad con cupo para el canal de la ficha. */
  rescheduleOptions(session, fichaId, fecha) {
    assertPermission(session, 'fichas.entregar');
    const snap = ds().snapshot(ALL);
    const f = snap.fichas.find((x) => x.id === fichaId);
    if (!f) throw new AppError('NO_ENCONTRADO');
    assertCenterAccess(session, f.centroId);
    const n = now();
    const maps = mapsOf(snap);
    return getDayBlocks(snap, {
      centroId: f.centroId,
      especialidadId: f.especialidadId,
      fecha,
      incluirBloqueados: false,
    })
      .filter((b) => fecha > n.date || (fecha === n.date && timeToMinutes(n.time) < timeToMinutes(b.horaFin)))
      .map((b) => ({
        horarioId: b.horarioId,
        medico: doctorName(maps.med.get(b.medicoId)),
        consultorio: maps.con.get(b.consultorioId)?.nombre,
        horaInicio: b.horaInicio,
        horaFin: b.horaFin,
        libres: f.canal === 'web' ? b.publicosLibres : b.libres,
      }));
  },

  /** Primera fecha (desde mañana, hasta 30 días) con algún bloque con cupo para la ficha. */
  nextRescheduleDate(session, fichaId) {
    for (let i = 1; i <= 30; i++) {
      const d = addDays(today(), i);
      if (this.rescheduleOptions(session, fichaId, d).some((b) => b.libres > 0)) return d;
    }
    return addDays(today(), 1);
  },

  /** Reprogramar (RN-FIC-08): original → reprogramada, nueva confirmada; la solicitud apunta a la nueva. */
  async reschedule(session, fichaId, { fecha, horarioId, motivo }) {
    await delay();
    assertPermission(session, 'fichas.entregar');
    if (!motivo?.trim())
      throw new AppError('VALIDACION', 'Indique el motivo de la reprogramación.', {
        fields: { motivo: 'Requerido.' },
      });
    const iso = nowIso();
    const n = now();
    return ds().transaction(ALL, (tx) => {
      const f = loadFicha(tx, session, fichaId);
      nextState('ficha', f.estado, 'reprogramar');
      if (rescheduleCount(tx, f) >= MAX_REPROGRAMACIONES)
        throw new AppError('VALIDACION', `La ficha ya se reprogramó ${MAX_REPROGRAMACIONES} veces.`);
      // La original deja de ocupar cupo antes de emitir la nueva (mismo día/paciente permitido).
      transition(tx, f, 'reprogramar', {}, iso, `Reprogramada: ${motivo.trim()}`);
      const nueva = issueTicket(tx, {
        horarioId,
        fecha,
        pacienteId: f.pacienteId,
        canal: f.canal,
        prioridad: f.prioridad,
        solicitudId: f.solicitudId,
        fichaOrigenId: f.id,
        usuarioId: session.usuarioId,
        now: n,
        iso,
        excluirFichaId: f.id,
        ignorarBloqueo: true,
      });
      if (nueva.especialidadId !== f.especialidadId)
        throw new AppError('VALIDACION', 'El bloque no corresponde a la especialidad.');
      if (f.solicitudId) {
        const s = tx.get(C.solicitudes, f.solicitudId);
        if (s)
          tx.update(C.solicitudes, s.id, {
            fichaId: nueva.id,
            fechaSolicitada: fecha,
            historial: [
              ...(s.historial || []),
              {
                estado: 'aprobada',
                fecha: iso,
                usuarioId: session.usuarioId,
                nota: `Reprogramada: ${f.codigoVisible} → ${nueva.codigoVisible} (${fecha.split('-').reverse().join('/')} ${nueva.horaEstimada}). ${motivo.trim()}`,
              },
            ],
          });
      }
      notifyFreedSlot(tx, f, { motivo: 'Reprogramación' });
      return nueva;
    });
  },

  /** Cierre de jornada (RN-FIC-06) del centro de trabajo para la fecha (por defecto hoy). */
  async closeDay(session, { fecha } = {}) {
    await delay();
    assertPermission(session, 'fichas.entregar');
    const centroId = workCenter(session);
    const d = fecha || today();
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const stats = { ausentes: 0, cerradas: 0, bloqueados: 0 };
      for (const f of tx.filter(C.fichas, (x) => x.centroId === centroId && x.fecha === d)) {
        if (f.estado === 'en_atencion') {
          tx.update(C.fichas, f.id, {
            estado: 'atendida',
            finAtencionEn: iso,
            motivoEstado: 'Cierre de jornada',
          });
          stats.cerradas++;
        } else if (['confirmada', 'en_espera', 'llamada'].includes(f.estado)) {
          tx.update(C.fichas, f.id, { estado: 'ausente', motivoEstado: 'Cierre de jornada: no se presentó' });
          stats.ausentes++;
          const p = tx.get(C.pacientes, f.pacienteId);
          if (p && !isPatientBlocked(p)) {
            tx.update(
              C.pacientes,
              p.id,
              blockPatient(p, {
                fichaId: f.id,
                centroId,
                fecha: iso,
                usuarioId: session.usuarioId,
                nota: 'Cierre de jornada',
              }),
            );
            stats.bloqueados++;
          }
        }
      }
      return stats;
    });
  },

  // ------------------------------------------------------------------ Sala de espera y llamado
  /** Estado de la sala por consultorio (bloques de hoy). */
  async getQueue(session) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const centroId = workCenter(session);
    const d = today();
    const n = now();
    const snap = ds().snapshot(ALL);
    const maps = mapsOf(snap);
    const fichas = snap.fichas.filter(
      (f) =>
        f.centroId === centroId &&
        f.fecha === d &&
        (session.rol !== 'medico' || f.medicoId === session.medicoId),
    );
    const blocks = getDayBlocks(snap, { centroId, fecha: d, incluirBloqueados: false }).filter(
      (b) => session.rol !== 'medico' || b.medicoId === session.medicoId,
    );
    const byCons = new Map();
    for (const b of blocks) {
      if (!byCons.has(b.consultorioId))
        byCons.set(b.consultorioId, {
          consultorioId: b.consultorioId,
          consultorio: maps.con.get(b.consultorioId)?.nombre,
          bloques: [],
        });
      byCons.get(b.consultorioId).bloques.push({
        horarioId: b.horarioId,
        medico: doctorName(maps.med.get(b.medicoId)),
        especialidad: maps.esp.get(b.especialidadId)?.nombre,
        horaInicio: b.horaInicio,
        horaFin: b.horaFin,
        activo:
          timeToMinutes(n.time) >= timeToMinutes(b.horaInicio) &&
          timeToMinutes(n.time) < timeToMinutes(b.horaFin),
      });
    }
    for (const f of fichas)
      if (!byCons.has(f.consultorioId))
        byCons.set(f.consultorioId, {
          consultorioId: f.consultorioId,
          consultorio: maps.con.get(f.consultorioId)?.nombre,
          bloques: [],
        });
    return [...byCons.values()]
      .map((c) => {
        const fs = fichas.filter((f) => f.consultorioId === c.consultorioId).map((f) => viewOf(f, maps));
        return {
          ...c,
          actual: fs.find((f) => f.estado === 'llamada' || f.estado === 'en_atencion') || null,
          espera: fs.filter((f) => f.estado === 'en_espera').sort(queueOrder),
          porLlegar: fs.filter((f) => f.estado === 'confirmada').length,
          atendidas: fs.filter((f) => f.estado === 'atendida').length,
          ausentes: fs.filter((f) => f.estado === 'ausente').length,
        };
      })
      .sort((a, b) => (a.consultorio || '').localeCompare(b.consultorio || '', 'es', { numeric: true }));
  },

  /** Llamar siguiente (RN-FIC-03): una sola ficha llamada/en atención por consultorio. */
  async callNext(session, consultorioId) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const centroId = workCenter(session);
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const d = today();
      const delDia = tx.filter(
        C.fichas,
        (f) =>
          f.centroId === centroId &&
          f.fecha === d &&
          f.consultorioId === consultorioId &&
          (session.rol !== 'medico' || f.medicoId === session.medicoId),
      );
      const ocupado = delDia.find((f) => f.estado === 'llamada' || f.estado === 'en_atencion');
      if (ocupado)
        throw new AppError(
          'VALIDACION',
          `El consultorio ya tiene la ficha ${ocupado.codigoVisible} ${ocupado.estado === 'llamada' ? 'llamada' : 'en atención'}.`,
        );
      const next = delDia.filter((f) => f.estado === 'en_espera').sort(queueOrder)[0];
      if (!next) throw new AppError('VALIDACION', 'No hay pacientes en espera para este consultorio.');
      return transition(
        tx,
        next,
        'llamar',
        {
          llamadaEn: iso,
          llamadas: [...(next.llamadas || []), { fecha: iso, usuarioId: session.usuarioId }],
        },
        iso,
      );
    });
  },

  async repeatCall(session, fichaId) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const f = loadFicha(tx, session, fichaId);
      return transition(
        tx,
        f,
        'repetir_llamado',
        { llamadaEn: iso, llamadas: [...(f.llamadas || []), { fecha: iso, usuarioId: session.usuarioId }] },
        iso,
      );
    });
  },

  /** Ausente (RN-FIC-05) + bloqueo del paciente (RN-PAC-05). */
  async markAbsent(session, fichaId) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const f = loadFicha(tx, session, fichaId);
      const upd = transition(tx, f, 'marcar_ausente', {}, iso, 'No respondió al llamado');
      const p = tx.get(C.pacientes, f.pacienteId);
      if (p && !isPatientBlocked(p))
        tx.update(
          C.pacientes,
          p.id,
          blockPatient(p, { fichaId: f.id, centroId: f.centroId, fecha: iso, usuarioId: session.usuarioId }),
        );
      return upd;
    });
  },

  /** Llegó tarde el mismo día (RN-FIC-05): vuelve a espera y se levanta el bloqueo de esa ficha (RN-PAC-08). */
  async revertAbsence(session, fichaId) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const f = loadFicha(tx, session, fichaId);
      if (f.fecha !== today())
        throw new AppError('VALIDACION', 'Solo se revierte una ausencia el mismo día.');
      const upd = transition(tx, f, 'revertir_ausencia', { llegadaEn: iso }, iso, null);
      tx.update(C.fichas, f.id, { motivoEstado: null });
      const p = tx.get(C.pacientes, f.pacienteId);
      if (p?.bloqueo?.activo && p.bloqueo.fichaId === f.id)
        tx.update(
          C.pacientes,
          p.id,
          unblockPatient(p, {
            fecha: iso,
            usuarioId: session.usuarioId,
            nota: `Ausencia revertida (${f.codigoVisible}): llegó tarde`,
          }),
        );
      return upd;
    });
  },

  async startAttention(session, fichaId) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) =>
      transition(tx, loadFicha(tx, session, fichaId), 'iniciar_atencion', { inicioAtencionEn: iso }, iso),
    );
  },

  async finish(session, fichaId) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) =>
      transition(tx, loadFicha(tx, session, fichaId), 'finalizar', { finAtencionEn: iso }, iso),
    );
  },

  async backToQueue(session, fichaId) {
    await delay(0);
    assertPermission(session, 'llamado.controlar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) =>
      transition(tx, loadFicha(tx, session, fichaId), 'volver_a_espera', {}, iso),
    );
  },

  LLAMADAS_SUGERIR_AUSENTE: LIMITES.llamadasParaSugerirAusente,
};
