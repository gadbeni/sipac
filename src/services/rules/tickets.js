/**
 * Emisión y movimiento de fichas dentro de una transacción (BUSINESS_RULES §6.3 y §7).
 * Todas las funciones reciben `tx` (ver localDataSource.transaction): leen el estado fresco
 * del almacenamiento, validan capacidad y slot, y escriben. Como la transacción es síncrona,
 * dos pestañas no pueden asignar el mismo cupo (RN-APR-03/04).
 */
import { AppError } from '../errors';
import {
  blockKey,
  buildOccupancyIndex,
  buildPendingIndex,
  computeBlock,
  estimatedTime,
  isHorarioVigente,
  isOfferActive,
  nextFreeSlot,
} from './availability';
import { isPatientBlocked } from './patientBlock';
import { FICHA_ACTIVA, FICHA_OCUPA_CUPO, ID_PREFIX, LIMITES } from '@/config/constants';
import { formatTicketCode } from '@/utils/codes';
import { timeToMinutes } from '@/utils/dates';

const ACTIVA = new Set(FICHA_ACTIVA);
const OCUPA = new Set(FICHA_OCUPA_CUPO);
const SNAP_KEYS = [
  'centros',
  'centroEspecialidades',
  'especialidades',
  'horarios',
  'medicos',
  'medicoCentros',
  'excepcionesAgenda',
  'consultorios',
  'fichas',
  'solicitudes',
  'pacientes',
];

export const txSnap = (tx) => Object.fromEntries(SNAP_KEYS.map((k) => [k, tx.all(k)]));

/** Bloque efectivo recalculado con las fichas actuales de la transacción. */
export function freshBlock(tx, horarioId, fecha) {
  const snap = txSnap(tx);
  const h = snap.horarios.find((x) => x.id === horarioId);
  if (!h) throw new AppError('NO_ENCONTRADO', 'El horario no existe.');
  if (!isHorarioVigente(h, fecha) || !isOfferActive(snap, h, fecha))
    throw new AppError('FECHA_NO_DISPONIBLE', 'El horario no atiende en esa fecha.');
  return computeBlock(snap, h, fecha, {
    occupancy: buildOccupancyIndex(snap.fichas),
    pending: buildPendingIndex(snap.solicitudes),
  });
}

/** Correlativo por centro + especialidad + fecha; no se reutiliza (RN-APR-05). */
export function nextTicketNumber(fichas, { centroId, especialidadId, fecha }) {
  return (
    fichas
      .filter((f) => f.centroId === centroId && f.especialidadId === especialidadId && f.fecha === fecha)
      .reduce((m, f) => Math.max(m, f.numero || 0), 0) + 1
  );
}

/**
 * Crea una ficha `confirmada` validando todas las reglas de capacidad.
 * @param {object} p { horarioId, fecha, pacienteId, canal, prioridad, solicitudId, fichaOrigenId, usuarioId, now:{date,time}, iso }
 */
export function issueTicket(tx, p) {
  const block = freshBlock(tx, p.horarioId, p.fecha);
  const h = block.horario;
  if (p.fecha < p.now.date)
    throw new AppError('FECHA_NO_DISPONIBLE', 'No se emiten fichas para fechas pasadas.');
  if (p.fecha === p.now.date && timeToMinutes(p.now.time) >= timeToMinutes(h.horaFin)) {
    throw new AppError('FECHA_NO_DISPONIBLE', 'Ese bloque de atención ya terminó.'); // RN-APR-08
  }
  if (block.bloqueado) throw new AppError('FECHA_NO_DISPONIBLE', `Agenda bloqueada: ${block.motivoBloqueo}`);
  if (block.ocupados >= block.cuposEfectivos) throw new AppError('CUPO_AGOTADO'); // RN-APR-03
  if (p.canal === 'web' && block.ocupadosWeb >= block.cuposPublicosEfectivos) {
    throw new AppError(
      'CUPO_AGOTADO',
      'No quedan cupos para solicitudes web en ese bloque. Las fichas restantes son de ventanilla.',
    );
  }
  const paciente = tx.get('pacientes', p.pacienteId);
  if (!paciente) throw new AppError('NO_ENCONTRADO', 'Paciente inexistente.');
  // RN-PAC-09: una reprogramación respeta la ficha ya emitida aunque el paciente esté bloqueado.
  if (!p.ignorarBloqueo && isPatientBlocked(paciente))
    throw new AppError(
      'PACIENTE_BLOQUEADO',
      'El paciente está bloqueado por inasistencia. Habilítelo antes de emitir una ficha.',
    );
  const dup = tx.find(
    'fichas',
    (f) =>
      f.pacienteId === p.pacienteId &&
      f.centroId === h.centroId &&
      f.especialidadId === h.especialidadId &&
      f.fecha === p.fecha &&
      ACTIVA.has(f.estado) &&
      f.id !== p.excluirFichaId,
  );
  if (dup)
    throw new AppError(
      'SOLICITUD_DUPLICADA',
      `El paciente ya tiene la ficha ${dup.codigoVisible} para esa fecha y especialidad.`,
    );

  const slot = nextFreeSlot(block);
  if (!slot) throw new AppError('CUPO_AGOTADO');
  // RN-APR-04: verificación final de unicidad del cupo.
  if (
    tx.find(
      'fichas',
      (f) => OCUPA.has(f.estado) && f.horarioId === h.id && f.fecha === p.fecha && f.slot === slot,
    )
  )
    throw new AppError('CONFLICTO_DATOS');

  const esp = tx.get('especialidades', h.especialidadId);
  const numero = nextTicketNumber(tx.all('fichas'), {
    centroId: h.centroId,
    especialidadId: h.especialidadId,
    fecha: p.fecha,
  });
  return tx.insert(
    'fichas',
    {
      solicitudId: p.solicitudId || null,
      centroId: h.centroId,
      pacienteId: p.pacienteId,
      especialidadId: h.especialidadId,
      medicoId: h.medicoId,
      horarioId: h.id,
      consultorioId: h.consultorioId,
      fecha: p.fecha,
      numero,
      codigoVisible: formatTicketCode(esp.codigo, numero),
      slot,
      horaEstimada: estimatedTime(h, slot),
      canal: p.canal,
      estado: 'confirmada',
      prioridad: p.prioridad || 'normal',
      fichaOrigenId: p.fichaOrigenId || null,
      llamadas: [],
      emitidaEn: p.iso,
      llegadaEn: null,
      llamadaEn: null,
      inicioAtencionEn: null,
      finAtencionEn: null,
      canceladaEn: null,
      emitidaPor: p.usuarioId,
      motivoEstado: null,
    },
    ID_PREFIX.fichas,
  );
}

/** Cantidad de reprogramaciones previas en la cadena (RN-FIC-08). */
export function rescheduleCount(tx, ficha) {
  let n = 0;
  let cur = ficha;
  while (cur?.fichaOrigenId) {
    n += 1;
    cur = tx.get('fichas', cur.fichaOrigenId);
  }
  return n;
}
export const MAX_REPROGRAMACIONES = LIMITES.maxReprogramaciones;

/**
 * RN-SOL-11: al liberarse un cupo, avisa a recepción si hay solicitudes en lista de espera para
 * esa especialidad y fecha (la aprobación sigue siendo manual).
 */
export function notifyFreedSlot(tx, ficha, { motivo }) {
  const enEspera = tx.filter(
    'solicitudes',
    (s) =>
      s.centroId === ficha.centroId &&
      s.especialidadId === ficha.especialidadId &&
      s.fechaSolicitada === ficha.fecha &&
      s.estado === 'lista_espera',
  ).length;
  const esp = tx.get('especialidades', ficha.especialidadId);
  const fecha = ficha.fecha.split('-').reverse().join('/');
  tx.insert(
    'notificaciones',
    {
      centroId: ficha.centroId,
      destinoUsuarioId: null,
      destinoRoles: ['admin_centro', 'recepcionista'],
      tipo: enEspera ? 'lista_espera' : 'cupo_liberado',
      titulo: enEspera ? 'Cupo liberado con lista de espera' : 'Cupo liberado',
      mensaje: `${motivo}: ficha ${ficha.codigoVisible} (${esp?.nombre}, ${fecha}).${enEspera ? ` Hay ${enEspera} en lista de espera para esa fecha.` : ''}`,
      enlace: enEspera ? '/admin/solicitudes?tab=lista_espera' : '/admin/entrega',
      leidaPor: [],
    },
    ID_PREFIX.notificaciones,
  );
  return enEspera;
}

export const blockKeyOf = (f) => blockKey(f.horarioId, f.fecha);

/**
 * Mueve una ficha a otro bloque (reprogramación): la original queda `reprogramada` y se emite
 * una nueva `confirmada` vinculada; la solicitud apunta a la nueva (RN-FIC-08).
 */
export function moveTicket(tx, f, { horarioId, fecha, usuarioId, now, iso, nota }) {
  tx.update('fichas', f.id, { estado: 'reprogramada', motivoEstado: nota });
  const nueva = issueTicket(tx, {
    horarioId,
    fecha,
    pacienteId: f.pacienteId,
    canal: f.canal,
    prioridad: f.prioridad,
    solicitudId: f.solicitudId,
    fichaOrigenId: f.id,
    usuarioId,
    now,
    iso,
    excluirFichaId: f.id,
    ignorarBloqueo: true,
  });
  if (f.solicitudId) {
    const s = tx.get('solicitudes', f.solicitudId);
    if (s)
      tx.update('solicitudes', s.id, {
        fichaId: nueva.id,
        fechaSolicitada: fecha,
        historial: [
          ...(s.historial || []),
          {
            estado: 'aprobada',
            fecha: iso,
            usuarioId,
            nota: `${nota}: ${f.codigoVisible} → ${nueva.codigoVisible} (${fecha.split('-').reverse().join('/')} ${nueva.horaEstimada})`,
          },
        ],
      });
  }
  return nueva;
}

/** Cancela una ficha (y su solicitud aprobada) con motivo. */
export function cancelTicket(tx, f, { usuarioId, iso, motivo }) {
  tx.update('fichas', f.id, { estado: 'cancelada', canceladaEn: iso, motivoEstado: motivo });
  if (f.solicitudId) {
    const s = tx.get('solicitudes', f.solicitudId);
    if (s && s.estado === 'aprobada' && s.fichaId === f.id)
      tx.update('solicitudes', s.id, {
        estado: 'cancelada',
        motivoEstado: motivo,
        historial: [
          ...(s.historial || []),
          {
            estado: 'cancelada',
            fecha: iso,
            usuarioId,
            nota: `Ficha ${f.codigoVisible} cancelada: ${motivo}`,
          },
        ],
      });
  }
}
