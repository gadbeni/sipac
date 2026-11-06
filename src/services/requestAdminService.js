/**
 * Gestión de solicitudes en el panel (Épica 8, flujo F2). Permiso `solicitudes.gestionar`
 * y acceso al centro de la solicitud en cada operación (RN-USR-01).
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { assertCenterAccess, assertPermission, scopeCenter } from './auth/guards';
import { chooseBlock, getDayBlocks } from './rules/availability';
import { availableActions, nextState } from './rules/stateMachines';
import { issueTicket, notifyFreedSlot, txSnap } from './rules/tickets';
import { doctorName } from './rules/portal';
import { COLLECTIONS as C, FICHA_ACTIVA, MOTIVOS_CANCELACION, MOTIVOS_RECHAZO } from '@/config/constants';
import { currentTime, nowIso, timeToMinutes, today } from '@/utils/dates';
import { normalizeText } from '@/utils/text';

const ds = () => getDataSource();
const ALL = Object.values(C);
const now = () => ({ date: today(), time: currentTime() });
export const TABS = {
  pendientes: ['pendiente'],
  emitidas: ['aprobada'],
  lista_espera: ['lista_espera'],
  cerradas: ['cancelada', 'rechazada', 'vencida'],
};

export const userLabel = (usuarios, id) => {
  if (id === 'publico') return 'Ciudadano (portal)';
  if (id === 'sistema') return 'Sistema';
  return usuarios.find((u) => u.id === id)?.nombre || id;
};

function rowOf(snap, s, maps) {
  const p = maps.pac.get(s.pacienteId);
  const f = s.fichaId ? maps.fic.get(s.fichaId) : null;
  const medId = f?.medicoId || s.medicoPreferidoId;
  return {
    id: s.id,
    codigo: s.codigo,
    estado: s.estado,
    centroId: s.centroId,
    centro: maps.cen.get(s.centroId)?.nombre,
    fecha: s.fechaSolicitada,
    especialidadId: s.especialidadId,
    especialidad: maps.esp.get(s.especialidadId)?.nombre,
    medicoId: medId || null,
    medico: medId ? doctorName(maps.med.get(medId)) : null,
    medicoAsignado: Boolean(f),
    paciente: p ? `${p.nombres} ${p.apellidos}` : '—',
    documento: p ? `${p.numeroDocumento}${p.complemento ? `-${p.complemento}` : ''}` : '',
    pacienteBloqueado: Boolean(p?.bloqueo?.activo),
    datosPorVerificar: Boolean(s.datosPorVerificar),
    ficha: f ? { id: f.id, codigo: f.codigoVisible, estado: f.estado, horaEstimada: f.horaEstimada } : null,
    motivo: s.motivoEstado,
    creadoEn: s.creadoEn,
    actualizadoEn: s.actualizadoEn,
  };
}

const mapsOf = (snap) => ({
  pac: new Map(snap.pacientes.map((x) => [x.id, x])),
  fic: new Map(snap.fichas.map((x) => [x.id, x])),
  esp: new Map(snap.especialidades.map((x) => [x.id, x])),
  med: new Map(snap.medicos.map((x) => [x.id, x])),
  cen: new Map(snap.centros.map((x) => [x.id, x])),
  con: new Map(snap.consultorios.map((x) => [x.id, x])),
});

/** Bloques de la fecha con cupos para el canal (para aprobar/reasignar), excluye los ya terminados. */
function blocksFor(snap, { centroId, especialidadId, fecha }, n = now()) {
  const maps = mapsOf(snap);
  return getDayBlocks(snap, { centroId, especialidadId, fecha })
    .filter((b) => fecha > n.date || timeToMinutes(n.time) < timeToMinutes(b.horaFin))
    .map((b) => ({
      horarioId: b.horarioId,
      medicoId: b.medicoId,
      medico: doctorName(maps.med.get(b.medicoId)),
      consultorio: maps.con.get(b.consultorioId)?.nombre,
      horaInicio: b.horaInicio,
      horaFin: b.horaFin,
      cupos: b.cuposEfectivos,
      libres: b.libres,
      publicosLibres: b.publicosLibres,
      bloqueado: b.bloqueado,
      motivoBloqueo: b.motivoBloqueo,
    }));
}

function loadForAction(tx, session, id) {
  const s = tx.get(C.solicitudes, id);
  if (!s) throw new AppError('NO_ENCONTRADO');
  assertCenterAccess(session, s.centroId);
  return s;
}

const pushHist = (s, estado, usuarioId, nota, iso) => [
  ...(s.historial || []),
  { estado, fecha: iso, usuarioId, nota: nota || null },
];

export const requestAdminService = {
  TABS,

  async list(session, { tab = 'pendientes', fecha, especialidadId, medicoId, q } = {}) {
    await delay();
    assertPermission(session, 'solicitudes.gestionar');
    const centroId = scopeCenter(session);
    const snap = ds().snapshot(ALL);
    const maps = mapsOf(snap);
    const estados = new Set(TABS[tab] || TABS.pendientes);
    const query = normalizeText(q);
    const rows = snap.solicitudes
      .filter((s) => (!centroId || s.centroId === centroId) && estados.has(s.estado))
      .filter(
        (s) =>
          (!fecha || s.fechaSolicitada === fecha) && (!especialidadId || s.especialidadId === especialidadId),
      )
      .map((s) => rowOf(snap, s, maps))
      .filter((r) => !medicoId || r.medicoId === medicoId)
      .filter(
        (r) =>
          !query ||
          normalizeText(`${r.codigo} ${r.paciente} ${r.documento} ${r.ficha?.codigo || ''}`).includes(query),
      );
    // RN-SOL-12: pendientes y lista de espera por orden de llegada.
    return rows.sort((a, b) =>
      tab === 'pendientes' || tab === 'lista_espera'
        ? a.creadoEn < b.creadoEn
          ? -1
          : 1
        : a.fecha < b.fecha
          ? 1
          : a.fecha > b.fecha
            ? -1
            : 0,
    );
  },

  async counts(session) {
    await delay(0);
    assertPermission(session, 'solicitudes.gestionar');
    const centroId = scopeCenter(session);
    const sols = ds()
      .list(C.solicitudes)
      .filter((s) => !centroId || s.centroId === centroId);
    return Object.fromEntries(
      Object.entries(TABS).map(([k, est]) => [k, sols.filter((s) => est.includes(s.estado)).length]),
    );
  },

  /** Opciones de filtro del centro activo. */
  filterOptions(session) {
    assertPermission(session, 'solicitudes.gestionar');
    const centroId = scopeCenter(session);
    const snap = ds().snapshot([C.especialidades, C.centroEspecialidades, C.medicos, C.medicoCentros]);
    const espIds = new Set(
      snap.centroEspecialidades
        .filter((x) => !centroId || x.centroId === centroId)
        .map((x) => x.especialidadId),
    );
    const medIds = new Set(
      snap.medicoCentros.filter((x) => !centroId || x.centroId === centroId).map((x) => x.medicoId),
    );
    return {
      especialidades: snap.especialidades
        .filter((e) => espIds.has(e.id))
        .map((e) => ({ value: e.id, label: e.nombre })),
      medicos: snap.medicos
        .filter((m) => medIds.has(m.id))
        .map((m) => ({ value: m.id, label: doctorName(m) })),
    };
  },

  async getDetail(session, id) {
    await delay();
    assertPermission(session, 'solicitudes.gestionar');
    const snap = ds().snapshot(ALL);
    const s = snap.solicitudes.find((x) => x.id === id);
    if (!s) throw new AppError('NO_ENCONTRADO');
    assertCenterAccess(session, s.centroId);
    const maps = mapsOf(snap);
    const p = maps.pac.get(s.pacienteId);
    const f = s.fichaId ? maps.fic.get(s.fichaId) : null;
    const activos = snap.solicitudes.filter(
      (x) =>
        x.pacienteId === p.id &&
        x.id !== s.id &&
        ['pendiente', 'lista_espera', 'aprobada'].includes(x.estado) &&
        x.fechaSolicitada >= today(),
    );
    return {
      ...rowOf(snap, s, maps),
      canal: s.canal,
      medicoPreferido: s.medicoPreferidoId ? doctorName(maps.med.get(s.medicoPreferidoId)) : null,
      medicoPreferidoId: s.medicoPreferidoId,
      paciente: {
        id: p.id,
        nombre: `${p.nombres} ${p.apellidos}`,
        tipoDocumento: p.tipoDocumento,
        numeroDocumento: p.numeroDocumento,
        complemento: p.complemento,
        fechaNacimiento: p.fechaNacimiento,
        telefono: p.telefono,
        verificado: p.verificado,
        bloqueo: p.bloqueo,
      },
      fichaDetalle: f
        ? {
            ...f,
            consultorio: maps.con.get(f.consultorioId)?.nombre,
            medico: doctorName(maps.med.get(f.medicoId)),
          }
        : null,
      historial: (s.historial || []).map((h) => ({ ...h, usuario: userLabel(snap.usuarios, h.usuarioId) })),
      otrasActivas: activos.map((x) => ({
        codigo: x.codigo,
        fecha: x.fechaSolicitada,
        estado: x.estado,
        especialidad: maps.esp.get(x.especialidadId)?.nombre,
      })),
      acciones: availableActions('solicitud', s.estado).filter((a) => a !== 'vencer'),
      bloques:
        ['pendiente', 'lista_espera'].includes(s.estado) && s.fechaSolicitada >= today()
          ? blocksFor(snap, {
              centroId: s.centroId,
              especialidadId: s.especialidadId,
              fecha: s.fechaSolicitada,
            })
          : [],
    };
  },

  /**
   * Aprobar = emitir ficha (RN-APR-01). Sin `horarioId` elige el bloque del médico preferido o
   * el de más cupos (RN-APR-02). Canal web: solo cupos públicos (RN-APR-03).
   */
  async approve(session, id, { horarioId } = {}) {
    await delay();
    assertPermission(session, 'solicitudes.gestionar');
    const iso = nowIso();
    const n = now();
    return ds().transaction(ALL, (tx) => {
      const s = loadForAction(tx, session, id);
      nextState('solicitud', s.estado, 'aprobar');
      let hid = horarioId;
      if (!hid) {
        const snap = txSnap(tx);
        const usable = getDayBlocks(snap, {
          centroId: s.centroId,
          especialidadId: s.especialidadId,
          fecha: s.fechaSolicitada,
        }).filter((b) => s.fechaSolicitada > n.date || timeToMinutes(n.time) < timeToMinutes(b.horaFin));
        const pick = chooseBlock(usable, { medicoPreferidoId: s.medicoPreferidoId, canal: s.canal });
        if (!pick.block) {
          if (pick.reason === 'MEDICO_SIN_CUPO')
            throw new AppError(
              'MEDICO_NO_DISPONIBLE',
              'El profesional preferido no tiene cupos para esta solicitud. Elija otro bloque o pase a lista de espera.',
            );
          throw new AppError(
            'CUPO_AGOTADO',
            'No quedan cupos para esta fecha. Puede pasar la solicitud a lista de espera.',
          );
        }
        hid = pick.block.horarioId;
      }
      const ficha = issueTicket(tx, {
        horarioId: hid,
        fecha: s.fechaSolicitada,
        pacienteId: s.pacienteId,
        canal: s.canal,
        solicitudId: s.id,
        usuarioId: session.usuarioId,
        now: n,
        iso,
      });
      if (ficha.especialidadId !== s.especialidadId || ficha.centroId !== s.centroId)
        throw new AppError('VALIDACION', 'El bloque no corresponde a la especialidad de la solicitud.');
      const med = tx.get(C.medicos, ficha.medicoId);
      const reasignado = s.medicoPreferidoId && s.medicoPreferidoId !== ficha.medicoId;
      const nota = `Ficha ${ficha.codigoVisible} · ${doctorName(med)} · ${ficha.horaEstimada}${reasignado ? ' (reasignado del profesional preferido)' : ''}`;
      tx.update(C.solicitudes, s.id, {
        estado: 'aprobada',
        fichaId: ficha.id,
        motivoEstado: null,
        historial: pushHist(s, 'aprobada', session.usuarioId, nota, iso),
      });
      return ficha;
    });
  },

  async reject(session, id, { motivo, detalle } = {}) {
    await delay();
    assertPermission(session, 'solicitudes.gestionar');
    if (!motivo || !MOTIVOS_RECHAZO.includes(motivo))
      throw new AppError('VALIDACION', 'Seleccione el motivo del rechazo.', {
        fields: { motivo: 'Requerido.' },
      });
    if (motivo === 'Otro' && !detalle?.trim())
      throw new AppError('VALIDACION', 'Describa el motivo.', { fields: { detalle: 'Requerido.' } });
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const s = loadForAction(tx, session, id);
      const estado = nextState('solicitud', s.estado, 'rechazar');
      const texto = detalle?.trim() ? `${motivo}: ${detalle.trim()}` : motivo;
      return tx.update(C.solicitudes, s.id, {
        estado,
        motivoEstado: texto,
        historial: pushHist(s, estado, session.usuarioId, texto, iso),
      });
    });
  },

  async moveToWaitlist(session, id, { nota } = {}) {
    await delay();
    assertPermission(session, 'solicitudes.gestionar');
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const s = loadForAction(tx, session, id);
      const estado = nextState('solicitud', s.estado, 'a_lista_espera');
      return tx.update(C.solicitudes, s.id, {
        estado,
        historial: pushHist(s, estado, session.usuarioId, nota?.trim() || 'Sin cupo disponible', iso),
      });
    });
  },

  /** Cancela la solicitud y, si fue aprobada, su ficha (RN-SOL-10). */
  async cancel(session, id, { motivo, detalle } = {}) {
    await delay();
    assertPermission(session, 'solicitudes.gestionar');
    if (!motivo || !MOTIVOS_CANCELACION.includes(motivo))
      throw new AppError('VALIDACION', 'Seleccione el motivo de la cancelación.', {
        fields: { motivo: 'Requerido.' },
      });
    if (motivo === 'Otro' && !detalle?.trim())
      throw new AppError('VALIDACION', 'Describa el motivo.', { fields: { detalle: 'Requerido.' } });
    const iso = nowIso();
    return ds().transaction(ALL, (tx) => {
      const s = loadForAction(tx, session, id);
      const estado = nextState('solicitud', s.estado, 'cancelar');
      const texto = detalle?.trim() ? `${motivo}: ${detalle.trim()}` : motivo;
      if (s.fichaId) {
        const f = tx.get(C.fichas, s.fichaId);
        if (f && FICHA_ACTIVA.includes(f.estado)) {
          tx.update(C.fichas, f.id, {
            estado: nextState('ficha', f.estado, 'cancelar'),
            canceladaEn: iso,
            motivoEstado: texto,
          });
          notifyFreedSlot(tx, f, { motivo: 'Cancelación' });
        }
      }
      return tx.update(C.solicitudes, s.id, {
        estado,
        motivoEstado: texto,
        historial: pushHist(s, estado, session.usuarioId, texto, iso),
      });
    });
  },
};
