/**
 * Reglas puras de solicitudes públicas (BUSINESS_RULES §6): duplicados, límite, opciones de
 * médico, horario estimado y ventana de cancelación ciudadana.
 */
import { FICHA_ACTIVA, LIMITES, SOLICITUD_ACTIVA } from '@/config/constants';
import { documentKey } from '@/utils/codes';
import { diffMinutesIso, toIso, timeToMinutes } from '@/utils/dates';
import { centerConfig, getDayBlocks, publicBlocks } from './availability';
import { doctorName } from './portal';

const ACTIVA_SOL = new Set(SOLICITUD_ACTIVA);
const ACTIVA_FIC = new Set(FICHA_ACTIVA);

export const findPatientByDocument = (pacientes, doc) => {
  const k = documentKey(doc);
  return pacientes.find((p) => documentKey(p) === k) || null;
};

/** ¿La solicitud sigue "viva"? pendiente / lista_espera, o aprobada con ficha activa (RN-SOL-02). */
export function isActiveRequest(s, fichasById) {
  if (ACTIVA_SOL.has(s.estado)) return true;
  if (s.estado === 'aprobada' && s.fichaId) return ACTIVA_FIC.has(fichasById.get(s.fichaId)?.estado);
  return false;
}

/** Duplicado: misma persona + centro + especialidad + fecha con solicitud o ficha activa. */
export function findDuplicate(snap, { pacienteId, centroId, especialidadId, fecha }) {
  const fichasById = new Map(snap.fichas.map((f) => [f.id, f]));
  const sol = snap.solicitudes.find(
    (s) =>
      s.pacienteId === pacienteId &&
      s.centroId === centroId &&
      s.especialidadId === especialidadId &&
      s.fechaSolicitada === fecha &&
      isActiveRequest(s, fichasById),
  );
  if (sol) return sol;
  return (
    snap.fichas.find(
      (f) =>
        f.pacienteId === pacienteId &&
        f.centroId === centroId &&
        f.especialidadId === especialidadId &&
        f.fecha === fecha &&
        ACTIVA_FIC.has(f.estado),
    ) || null
  );
}

/** Solicitudes activas del paciente con fecha ≥ hoy, en todos los centros (RN-SOL-03). */
export function countActiveRequests(snap, pacienteId, hoy) {
  const fichasById = new Map(snap.fichas.map((f) => [f.id, f]));
  return snap.solicitudes.filter(
    (s) => s.pacienteId === pacienteId && s.fechaSolicitada >= hoy && isActiveRequest(s, fichasById),
  ).length;
}

export const limitReached = (n) => n >= LIMITES.maxSolicitudesActivasPorPaciente;

/** Bloques utilizables por el portal en la fecha (sin bloqueos, respetando el cierre del mismo día). */
export function usablePublicBlocks(snap, { centroId, especialidadId, fecha, now }) {
  const centro = snap.centros.find((c) => c.id === centroId);
  const all = getDayBlocks(snap, { centroId, especialidadId, fecha });
  return publicBlocks(all, fecha, now, centerConfig(centro).cierreMismoDiaMin);
}

/** Profesionales que se pueden elegir en el asistente: con cupos por internet libres ese día. */
export function doctorOptions(snap, params) {
  const meds = new Map(snap.medicos.map((m) => [m.id, m]));
  const byDoctor = new Map();
  for (const b of usablePublicBlocks(snap, params)) {
    if (b.publicosLibres <= 0) continue;
    const m = meds.get(b.medicoId);
    if (!byDoctor.has(m.id))
      byDoctor.set(m.id, { id: m.id, nombre: doctorName(m), publicosLibres: 0, bloques: [] });
    const d = byDoctor.get(m.id);
    d.publicosLibres += b.publicosLibres;
    d.bloques.push({ horaInicio: b.horaInicio, horaFin: b.horaFin });
  }
  return [...byDoctor.values()].sort(
    (a, b) => timeToMinutes(a.bloques[0].horaInicio) - timeToMinutes(b.bloques[0].horaInicio),
  );
}

/** Franja informativa para una solicitud aún sin ficha: del primer inicio al último fin. */
export function estimatedWindow(snap, { centroId, especialidadId, fecha, medicoId = null }) {
  const blocks = getDayBlocks(snap, {
    centroId,
    especialidadId,
    fecha,
    medicoId: medicoId || undefined,
    incluirBloqueados: false,
  });
  if (!blocks.length) return null;
  const start = blocks.map((b) => b.horaInicio).sort()[0];
  const end = blocks
    .map((b) => b.horaFin)
    .sort()
    .at(-1);
  return { horaInicio: start, horaFin: end };
}

/**
 * ¿Puede el ciudadano cancelar? (RN-SOL-13)
 * pendiente / lista_espera: siempre. aprobada + ficha confirmada: hasta 2 h antes de la hora estimada.
 */
export function citizenCancelInfo(solicitud, ficha, nowIso) {
  if (ACTIVA_SOL.has(solicitud.estado)) return { puede: true, hasta: null };
  if (solicitud.estado === 'aprobada' && ficha?.estado === 'confirmada') {
    const limite = toIso(ficha.fecha, ficha.horaEstimada);
    const minutos = diffMinutesIso(nowIso, limite);
    const hasta = {
      fecha: ficha.fecha,
      hora: ficha.horaEstimada,
      horasAntes: LIMITES.cancelacionCiudadanaMinHoras,
    };
    return { puede: minutos >= LIMITES.cancelacionCiudadanaMinHoras * 60, hasta };
  }
  return { puede: false, hasta: null };
}
