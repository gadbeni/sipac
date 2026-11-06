/**
 * Indicadores del dashboard y reportes (BUSINESS_RULES §10). Funciones puras sobre un snapshot.
 * `scope = { centroId: string|null (null = todos), medicoId?: string }`.
 */
import { addDays, diffMinutesIso, isoToDate, isoWeekday, timeToMinutes } from '@/utils/dates';
import { getDayBlocks } from './availability';

const NO_EMITIDA = new Set(['cancelada', 'reprogramada']);
const inScope = (x, { centroId, medicoId }) =>
  (!centroId || x.centroId === centroId) && (!medicoId || x.medicoId === medicoId);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
export const lastDays = (today, n) => Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));

/** Bloques efectivos de hoy (sin bloqueados) dentro del alcance. */
function todayBlocks(snap, scope, today) {
  const centros = scope.centroId ? [scope.centroId] : snap.centros.filter((c) => c.activo).map((c) => c.id);
  return centros.flatMap((centroId) =>
    getDayBlocks(snap, { centroId, fecha: today, medicoId: scope.medicoId, incluirBloqueados: false }),
  );
}

export function computeKpis(snap, scope, { today }) {
  const fichas = snap.fichas.filter((f) => inScope(f, scope));
  const hoy = fichas.filter((f) => f.fecha === today);
  const blocks = todayBlocks(snap, scope, today);
  const cuposEfectivos = blocks.reduce((s, b) => s + b.cuposEfectivos, 0);
  const ocupados = blocks.reduce((s, b) => s + Math.min(b.ocupados, b.cuposEfectivos), 0);
  const ventana = new Set(lastDays(today, 7));
  const cerradas = fichas.filter(
    (f) => ventana.has(f.fecha) && (f.estado === 'atendida' || f.estado === 'ausente'),
  );
  const ausentes = cerradas.filter((f) => f.estado === 'ausente').length;
  const esperas = fichas
    .filter((f) => ventana.has(f.fecha) && f.estado === 'atendida' && f.llegadaEn && f.inicioAtencionEn)
    .map((f) => diffMinutesIso(f.llegadaEn, f.inicioAtencionEn))
    .filter((m) => m >= 0);
  const sols = scope.medicoId ? [] : snap.solicitudes.filter((s) => inScope(s, scope));
  const manana = addDays(today, 1);
  return {
    fichasHoy: hoy.filter((f) => !NO_EMITIDA.has(f.estado)).length,
    fichasDisponibles: blocks.reduce((s, b) => s + b.libres, 0),
    solicitudesPendientes: sols.filter((s) => s.estado === 'pendiente' && s.fechaSolicitada >= today).length,
    pendientesHoyManana: sols.filter(
      (s) => s.estado === 'pendiente' && (s.fechaSolicitada === today || s.fechaSolicitada === manana),
    ).length,
    listaEspera: sols.filter((s) => s.estado === 'lista_espera' && s.fechaSolicitada >= today).length,
    enEspera: hoy.filter((f) => f.estado === 'en_espera' || f.estado === 'llamada').length,
    enAtencion: hoy.filter((f) => f.estado === 'en_atencion').length,
    atendidos: hoy.filter((f) => f.estado === 'atendida').length,
    porAtender: hoy.filter((f) => ['confirmada', 'en_espera', 'llamada', 'en_atencion'].includes(f.estado))
      .length,
    cuposEfectivosHoy: cuposEfectivos,
    ocupadosHoy: ocupados,
    ocupacionPct: pct(ocupados, cuposEfectivos),
    ausentismoPct: pct(ausentes, cerradas.length),
    ausentesSemana: ausentes,
    cerradasSemana: cerradas.length,
    esperaPromedioMin: esperas.length
      ? Math.round(esperas.reduce((a, b) => a + b, 0) / esperas.length)
      : null,
  };
}

/** Solicitudes por día de creación, últimos `days` días incluyendo hoy. */
export function requestsByDay(snap, scope, { today, days = 7 }) {
  const fechas = lastDays(today, days);
  const counts = new Map(fechas.map((f) => [f, { fecha: f, web: 0, total: 0 }]));
  for (const s of snap.solicitudes) {
    if (!inScope(s, scope)) continue;
    const d = counts.get(isoToDate(s.creadoEn));
    if (d) {
      d.total += 1;
      if (s.canal === 'web') d.web += 1;
    }
  }
  return [...counts.values()];
}

/** Demanda por especialidad (7 días): solicitudes creadas + fichas de ventanilla emitidas. */
export function demandBySpecialty(snap, scope, { today, days = 7 }) {
  const ventana = new Set(lastDays(today, days));
  const names = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
  const m = new Map();
  const add = (id, k) => {
    if (!m.has(id))
      m.set(id, {
        especialidadId: id,
        especialidad: names.get(id) || id,
        solicitudes: 0,
        ventanilla: 0,
        total: 0,
      });
    m.get(id)[k] += 1;
    m.get(id).total += 1;
  };
  for (const s of snap.solicitudes)
    if (inScope(s, scope) && ventana.has(isoToDate(s.creadoEn))) add(s.especialidadId, 'solicitudes');
  for (const f of snap.fichas)
    if (inScope(f, scope) && f.canal === 'ventanilla' && f.emitidaEn && ventana.has(isoToDate(f.emitidaEn)))
      add(f.especialidadId, 'ventanilla');
  return [...m.values()].sort(
    (a, b) => b.total - a.total || a.especialidad.localeCompare(b.especialidad, 'es'),
  );
}

/** Emitidas (no canceladas/reprogramadas) vs. atendidas por día de atención. */
export function issuedVsAttended(snap, scope, { today, days = 7 }) {
  const fechas = lastDays(today, days);
  const rows = new Map(fechas.map((f) => [f, { fecha: f, emitidas: 0, atendidas: 0 }]));
  for (const f of snap.fichas) {
    const r = rows.get(f.fecha);
    if (!r || !inScope(f, scope)) continue;
    if (!NO_EMITIDA.has(f.estado)) r.emitidas += 1;
    if (f.estado === 'atendida') r.atendidas += 1;
  }
  return [...rows.values()];
}

/** Fichas de la fecha por franja de 1 h según `horaEstimada` (D-12). */
export function distributionByHour(snap, scope, { fecha }) {
  const m = new Map();
  for (const f of snap.fichas) {
    if (f.fecha !== fecha || NO_EMITIDA.has(f.estado) || !inScope(f, scope) || !f.horaEstimada) continue;
    const h = Math.floor(timeToMinutes(f.horaEstimada) / 60);
    m.set(h, (m.get(h) || 0) + 1);
  }
  if (!m.size) return [];
  const hs = [...m.keys()];
  const out = [];
  for (let h = Math.min(...hs); h <= Math.max(...hs); h++)
    out.push({ hora: `${String(h).padStart(2, '0')}:00`, fichas: m.get(h) || 0 });
  return out;
}

/** Solicitudes por día de la semana (últimas 4 semanas) para insights. */
export function requestsByWeekday(snap, scope, { today, days = 28 }) {
  const ventana = new Set(lastDays(today, days));
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const s of snap.solicitudes) {
    if (!inScope(s, scope)) continue;
    const d = isoToDate(s.creadoEn);
    if (ventana.has(d)) counts[isoWeekday(d)] += 1;
  }
  return counts;
}

/** Ocupación de hoy y mañana por especialidad (para insights de cupos escasos). */
export function occupancyBySpecialty(snap, scope, { fecha }) {
  const names = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
  const centros = scope.centroId ? [scope.centroId] : snap.centros.filter((c) => c.activo).map((c) => c.id);
  const m = new Map();
  for (const centroId of centros) {
    for (const b of getDayBlocks(snap, { centroId, fecha, incluirBloqueados: false })) {
      if (!m.has(b.especialidadId))
        m.set(b.especialidadId, {
          especialidadId: b.especialidadId,
          especialidad: names.get(b.especialidadId),
          cupos: 0,
          libres: 0,
        });
      const r = m.get(b.especialidadId);
      r.cupos += b.cuposEfectivos;
      r.libres += b.libres;
    }
  }
  return [...m.values()].filter((r) => r.cupos > 0);
}
