/**
 * Motor de disponibilidad (funciones puras).
 *
 * La disponibilidad nunca se almacena: se calcula a partir de
 *   horarios (plantillas) + excepciones de agenda + fichas que ocupan cupo  (RN-AGE-03).
 *
 * `snapshot` es un objeto con las colecciones necesarias:
 *   { centros, centroEspecialidades, medicos, medicoCentros, horarios, excepcionesAgenda, fichas, solicitudes }
 * `now` es { date: 'YYYY-MM-DD', time: 'HH:mm' } en America/La_Paz.
 */
import { FICHA_OCUPA_CUPO, CANALES, ESTADOS_SOLICITUD, LIMITES } from '@/config/constants';
import {
  isoWeekday,
  timeRangesOverlap,
  timeToMinutes,
  addMinutesToTime,
  addDays,
  diffDays,
} from '@/utils/dates';

const OCUPA = new Set(FICHA_OCUPA_CUPO);
const TIPOS_BLOQUEANTES = new Set(['feriado', 'ausencia', 'permiso', 'bloqueo']);

export const blockKey = (horarioId, fecha) => `${horarioId}|${fecha}`;

// ------------------------------------------------------------------ Índices

/** Índice de ocupación por horario+fecha. */
export function buildOccupancyIndex(fichas) {
  const idx = new Map();
  for (const f of fichas) {
    if (!OCUPA.has(f.estado)) continue;
    const k = blockKey(f.horarioId, f.fecha);
    let e = idx.get(k);
    if (!e) idx.set(k, (e = { ocupados: 0, ocupadosWeb: 0, slots: new Set() }));
    e.ocupados++;
    if (f.canal === CANALES.web) e.ocupadosWeb++;
    e.slots.add(f.slot);
  }
  return idx;
}

/** Índice de solicitudes pendientes por centro+especialidad+fecha (RN-DIS-03). */
export function buildPendingIndex(solicitudes) {
  const idx = new Map();
  for (const s of solicitudes) {
    if (s.estado !== ESTADOS_SOLICITUD.pendiente) continue;
    const k = `${s.centroId}|${s.especialidadId}|${s.fechaSolicitada}`;
    idx.set(k, (idx.get(k) || 0) + 1);
  }
  return idx;
}

function ensureIndexes(snapshot, index) {
  return {
    occupancy: index?.occupancy || buildOccupancyIndex(snapshot.fichas || []),
    pending: index?.pending || buildPendingIndex(snapshot.solicitudes || []),
  };
}

// ------------------------------------------------------------------ Horarios y excepciones

export function isHorarioVigente(h, fecha) {
  return (
    h.activo &&
    h.diaSemana === isoWeekday(fecha) &&
    (!h.vigenciaDesde || fecha >= h.vigenciaDesde) &&
    (!h.vigenciaHasta || fecha <= h.vigenciaHasta)
  );
}

/** ¿La excepción afecta al horario en esa fecha? (RN-AGE-01, RN-MC-04) */
export function exceptionApplies(exc, h, fecha) {
  if (fecha < exc.fechaInicio || fecha > exc.fechaFin) return false;
  let scope;
  switch (exc.alcance) {
    case 'global':
      scope = true;
      break;
    case 'centro':
      scope = exc.centroId === h.centroId;
      break;
    case 'especialidad':
      scope = exc.centroId === h.centroId && exc.especialidadId === h.especialidadId;
      break;
    case 'medico':
      // Sin centroId: ausencia global del médico (registrada por el admin central).
      scope = exc.medicoId === h.medicoId && (exc.centroId == null || exc.centroId === h.centroId);
      break;
    case 'horario':
      scope = exc.horarioId === h.id;
      break;
    default:
      scope = false;
  }
  if (!scope) return false;
  if (exc.horaInicio && exc.horaFin)
    return timeRangesOverlap(exc.horaInicio, exc.horaFin, h.horaInicio, h.horaFin);
  return true;
}

/** Valida que la oferta (centro, especialidad en centro, médico, vínculo) esté activa. */
export function isOfferActive(snapshot, h, fecha, { requireCentroActivo = true } = {}) {
  const centro = snapshot.centros?.find((c) => c.id === h.centroId);
  if (!centro || (requireCentroActivo && !centro.activo)) return false;
  const ce = snapshot.centroEspecialidades?.find(
    (x) => x.centroId === h.centroId && x.especialidadId === h.especialidadId,
  );
  if (!ce || !ce.activo) return false;
  const med = snapshot.medicos?.find((m) => m.id === h.medicoId);
  if (!med || !med.activo) return false;
  const mc = snapshot.medicoCentros?.find((m) => m.id === h.medicoCentroId);
  if (!mc || !mc.activo) return false;
  if (mc.fechaInicio && fecha < mc.fechaInicio) return false;
  if (mc.fechaFin && fecha > mc.fechaFin) return false;
  return true;
}

// ------------------------------------------------------------------ Bloques

/**
 * Bloque efectivo de un horario en una fecha (sin validar oferta activa).
 * @returns {object} bloque con cupos efectivos, ocupación y motivos de bloqueo
 */
export function computeBlock(snapshot, h, fecha, index) {
  const { occupancy } = ensureIndexes(snapshot, index);
  const excs = (snapshot.excepcionesAgenda || []).filter((e) => exceptionApplies(e, h, fecha));
  const bloqueos = excs.filter((e) => TIPOS_BLOQUEANTES.has(e.tipo));
  const ajuste = excs.filter((e) => e.tipo === 'ajuste_cupos').at(-1);

  const cuposBase = ajuste ? Math.max(0, ajuste.cuposAjustados ?? h.cupos) : h.cupos;
  const bloqueado = bloqueos.length > 0;
  const cuposEfectivos = bloqueado ? 0 : cuposBase;
  const cuposPublicosEfectivos = Math.min(h.cuposPublicos, cuposEfectivos);

  const occ = occupancy.get(blockKey(h.id, fecha)) || { ocupados: 0, ocupadosWeb: 0, slots: new Set() };
  const libres = Math.max(0, cuposEfectivos - occ.ocupados);
  const publicosLibres = Math.max(0, Math.min(cuposPublicosEfectivos - occ.ocupadosWeb, libres));

  return {
    horarioId: h.id,
    horario: h,
    fecha,
    centroId: h.centroId,
    medicoId: h.medicoId,
    especialidadId: h.especialidadId,
    consultorioId: h.consultorioId,
    horaInicio: h.horaInicio,
    horaFin: h.horaFin,
    duracionConsultaMin: h.duracionConsultaMin,
    cuposPlantilla: h.cupos,
    cuposEfectivos,
    cuposPublicosEfectivos,
    ocupados: occ.ocupados,
    ocupadosWeb: occ.ocupadosWeb,
    libres,
    publicosLibres,
    slotsOcupados: occ.slots,
    bloqueado,
    excepciones: excs,
    motivoBloqueo: bloqueos.map((b) => b.motivo).join(' · ') || null,
  };
}

/**
 * Bloques de agenda de un día, opcionalmente filtrados.
 * @param {{ centroId?: string, fecha: string, especialidadId?: string, medicoId?: string,
 *           incluirBloqueados?: boolean, requireCentroActivo?: boolean, index?: object }} params
 */
export function getDayBlocks(snapshot, params) {
  const {
    centroId,
    fecha,
    especialidadId,
    medicoId,
    incluirBloqueados = true,
    requireCentroActivo = true,
    index,
  } = params;
  const idx = ensureIndexes(snapshot, index);
  const out = [];
  for (const h of snapshot.horarios || []) {
    if (centroId && h.centroId !== centroId) continue;
    if (especialidadId && h.especialidadId !== especialidadId) continue;
    if (medicoId && h.medicoId !== medicoId) continue;
    if (!isHorarioVigente(h, fecha)) continue;
    if (!isOfferActive(snapshot, h, fecha, { requireCentroActivo })) continue;
    const b = computeBlock(snapshot, h, fecha, idx);
    if (!incluirBloqueados && b.bloqueado) continue;
    out.push(b);
  }
  return out.sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
}

// ------------------------------------------------------------------ Cupos y asignación

/** Menor slot libre 1..cuposEfectivos (RN-APR-04). */
export function nextFreeSlot(block) {
  for (let s = 1; s <= block.cuposEfectivos; s++) if (!block.slotsOcupados.has(s)) return s;
  return null;
}

/** Hora estimada = horaInicio + (slot − 1) × duración (RN-APR-06). */
export const estimatedTime = (horario, slot) =>
  addMinutesToTime(horario.horaInicio, (slot - 1) * horario.duracionConsultaMin);

/** ¿El bloque admite una ficha del canal indicado? */
export const blockHasCapacity = (block, canal) =>
  canal === CANALES.web ? block.publicosLibres > 0 : block.libres > 0;

/**
 * Elige el bloque para una nueva ficha (RN-APR-02).
 * @returns {{ block: object|null, reason?: 'SIN_CUPO'|'MEDICO_SIN_CUPO' }}
 */
export function chooseBlock(blocks, { medicoPreferidoId = null, canal = CANALES.web } = {}) {
  const candidates = blocks.filter((b) => !b.bloqueado && blockHasCapacity(b, canal));
  if (medicoPreferidoId) {
    const pref = candidates.filter((b) => b.medicoId === medicoPreferidoId);
    if (!pref.length) return { block: null, reason: candidates.length ? 'MEDICO_SIN_CUPO' : 'SIN_CUPO' };
    return { block: sortForAssignment(pref, canal)[0] };
  }
  if (!candidates.length) return { block: null, reason: 'SIN_CUPO' };
  return { block: sortForAssignment(candidates, canal)[0] };
}

function sortForAssignment(blocks, canal) {
  const free = (b) => (canal === CANALES.web ? b.publicosLibres : b.libres);
  return [...blocks].sort(
    (a, b) => free(b) - free(a) || timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio),
  );
}

// ------------------------------------------------------------------ Disponibilidad pública

/** Configuración del centro con valores por defecto. */
export function centerConfig(centro) {
  return {
    diasAnticipacionMax: centro?.config?.diasAnticipacionMax ?? LIMITES.diasAnticipacionMaxDefault,
    cierreMismoDiaMin: centro?.config?.cierreMismoDiaMin ?? LIMITES.cierreMismoDiaMinDefault,
    factorLimitePendientes: centro?.config?.factorLimitePendientes ?? LIMITES.factorLimitePendientesDefault,
  };
}

/** Bloques que aún admiten solicitudes web ese día (corte del mismo día, RN-DIS-01). */
export function publicBlocks(blocks, fecha, now, cierreMismoDiaMin) {
  return blocks.filter(
    (b) =>
      !b.bloqueado &&
      (fecha > now.date || timeToMinutes(now.time) < timeToMinutes(b.horaInicio) - cierreMismoDiaMin),
  );
}

/**
 * Disponibilidad pública de una especialidad en una fecha (RN-DIS-01, RN-DIS-03, RN-ESP-02).
 * @returns {{ disponible: boolean, motivo: string|null, publicosLibres: number, pendientes: number, bloques: object[] }}
 */
export function getPublicAvailability(snapshot, { centroId, especialidadId, fecha, now, index }) {
  const idx = ensureIndexes(snapshot, index);
  const res = (disponible, motivo, extra = {}) => ({
    disponible,
    motivo,
    publicosLibres: 0,
    pendientes: 0,
    bloques: [],
    ...extra,
  });

  const centro = snapshot.centros?.find((c) => c.id === centroId);
  if (!centro || !centro.activo) return res(false, 'CENTRO_INACTIVO');
  const ce = snapshot.centroEspecialidades?.find(
    (x) => x.centroId === centroId && x.especialidadId === especialidadId,
  );
  if (!ce || !ce.activo) return res(false, 'ESPECIALIDAD_NO_DISPONIBLE');
  if (!ce.aceptaSolicitudesPublicas) return res(false, 'SOLO_VENTANILLA');

  const cfg = centerConfig(centro);
  if (fecha < now.date) return res(false, 'FECHA_PASADA');
  if (diffDays(now.date, fecha) > cfg.diasAnticipacionMax) return res(false, 'FUERA_DE_VENTANA');

  const all = getDayBlocks(snapshot, { centroId, fecha, especialidadId, index: idx });
  if (!all.length) return res(false, 'SIN_HORARIO');
  if (all.every((b) => b.bloqueado)) return res(false, 'BLOQUEADO', { bloques: all });

  const usable = publicBlocks(all, fecha, now, cfg.cierreMismoDiaMin);
  if (!usable.length) return res(false, 'CIERRE_MISMO_DIA', { bloques: all });

  const publicosLibres = usable.reduce((s, b) => s + b.publicosLibres, 0);
  const pendientes = idx.pending.get(`${centroId}|${especialidadId}|${fecha}`) || 0;
  if (publicosLibres <= 0) return res(false, 'SIN_CUPOS', { bloques: usable, pendientes });
  if (pendientes >= publicosLibres * cfg.factorLimitePendientes) {
    return res(false, 'DEMANDA_ALTA', { bloques: usable, publicosLibres, pendientes });
  }
  return res(true, null, { bloques: usable, publicosLibres, pendientes });
}

/** Fechas habilitadas para el asistente público (hoy … hoy + diasAnticipacionMax). */
export function getEnabledDates(snapshot, { centroId, especialidadId, now }) {
  const centro = snapshot.centros?.find((c) => c.id === centroId);
  const { diasAnticipacionMax } = centerConfig(centro);
  const index = ensureIndexes(snapshot);
  const out = [];
  for (let i = 0; i <= diasAnticipacionMax; i++) {
    const fecha = addDays(now.date, i);
    const a = getPublicAvailability(snapshot, { centroId, especialidadId, fecha, now, index });
    if (a.disponible) out.push({ fecha, publicosLibres: a.publicosLibres, pendientes: a.pendientes });
  }
  return out;
}
