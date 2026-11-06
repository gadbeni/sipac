/**
 * Reglas puras sobre centros de salud (BUSINESS_RULES §2): búsqueda, filtros, distancia,
 * horario general y estado "abierto ahora". Sin efectos: se prueban en tests/centers.test.js.
 */
import { DIAS_SEMANA, TIPOS_CENTRO } from '@/config/constants';
import { isoWeekday, timeToMinutes } from '@/utils/dates';
import { distanceKm } from '@/utils/geo';
import { normalizeText, compareText } from '@/utils/text';

export const centerSearchText = (c) =>
  normalizeText(
    [c.nombre, c.codigoCorto, c.municipio, c.localidad, c.provincia, c.direccion, TIPOS_CENTRO[c.tipo]].join(
      ' ',
    ),
  );

/**
 * Filtra y ordena centros.
 * @param {object[]} centers
 * @param {{ q?: string, municipio?: string, tipo?: string, origin?: {lat:number,lng:number}|null, soloActivos?: boolean }} f
 * @returns {object[]} copias con `distanciaKm` (o null) — orden: distancia si hay origen, si no nombre.
 */
export function filterCenters(
  centers,
  { q = '', municipio = '', tipo = '', origin = null, soloActivos = true } = {},
) {
  const terms = normalizeText(q).split(/\s+/).filter(Boolean);
  const out = centers
    .filter(
      (c) =>
        (!soloActivos || c.activo) && (!municipio || c.municipio === municipio) && (!tipo || c.tipo === tipo),
    )
    .filter((c) => {
      if (!terms.length) return true;
      const hay = centerSearchText(c);
      return terms.every((t) => hay.includes(t));
    })
    .map((c) => ({
      ...c,
      distanciaKm:
        origin && Number.isFinite(c.latitud)
          ? distanceKm(origin.lat, origin.lng, c.latitud, c.longitud)
          : null,
    }));
  return out.sort((a, b) =>
    origin ? (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity) : compareText(a.nombre, b.nombre),
  );
}

/** Valores distintos para los filtros, con conteo (solo centros activos). */
export function centerFacets(centers) {
  const act = centers.filter((c) => c.activo);
  const count = (key) => {
    const m = new Map();
    for (const c of act) m.set(c[key], (m.get(c[key]) || 0) + 1);
    return [...m.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => compareText(a.value, b.value));
  };
  return {
    municipios: count('municipio'),
    tipos: count('tipo').map((t) => ({ ...t, label: TIPOS_CENTRO[t.value] || t.value })),
  };
}

/** Horario general vigente para un día ISO (1 = lunes … 7 = domingo) o null si no atiende. */
export const hoursForWeekday = (center, weekday) =>
  (center.horarioGeneral || []).find((g) => g.dias.includes(weekday)) || null;

/** Feriado o cierre total del centro en la fecha (excepciones globales o de centro sin franja horaria). */
export function closureFor(center, fecha, excepciones = []) {
  return (
    excepciones.find(
      (e) =>
        (e.tipo === 'feriado' || e.tipo === 'bloqueo') &&
        !e.horaInicio &&
        fecha >= e.fechaInicio &&
        fecha <= e.fechaFin &&
        (e.alcance === 'global' || (e.alcance === 'centro' && e.centroId === center.id)),
    ) || null
  );
}

/**
 * Estado de apertura en (fecha, hora).
 * @returns {{ abierto: boolean, motivo: 'ABIERTO'|'CERRADO_HOY'|'ANTES_DE_ABRIR'|'DESPUES_DE_CERRAR'|'FERIADO'|'INACTIVO',
 *             hoy: object|null, cierre?: object }}
 */
export function openStatus(center, fecha, hora, excepciones = []) {
  if (!center.activo) return { abierto: false, motivo: 'INACTIVO', hoy: null };
  const cierre = closureFor(center, fecha, excepciones);
  const hoy = hoursForWeekday(center, isoWeekday(fecha));
  if (cierre) return { abierto: false, motivo: 'FERIADO', hoy, cierre };
  if (!hoy) return { abierto: false, motivo: 'CERRADO_HOY', hoy };
  const m = timeToMinutes(hora);
  if (m < timeToMinutes(hoy.apertura)) return { abierto: false, motivo: 'ANTES_DE_ABRIR', hoy };
  if (m >= timeToMinutes(hoy.cierre)) return { abierto: false, motivo: 'DESPUES_DE_CERRAR', hoy };
  return { abierto: true, motivo: 'ABIERTO', hoy };
}

/** Texto breve del estado de apertura para tarjetas. */
export function openStatusLabel(st) {
  switch (st.motivo) {
    case 'ABIERTO':
      return { label: `Abierto · cierra ${st.hoy.cierre}`, tone: 'success' };
    case 'ANTES_DE_ABRIR':
      return { label: `Cerrado · abre ${st.hoy.apertura}`, tone: 'neutral' };
    case 'FERIADO':
      return { label: 'Cerrado por feriado', tone: 'warning' };
    case 'INACTIVO':
      return { label: 'No disponible', tone: 'neutral' };
    default:
      return { label: 'Cerrado ahora', tone: 'neutral' };
  }
}

/** "Lunes a viernes", "Sábado", "Lunes, miércoles y viernes". */
export function formatDays(dias) {
  const sorted = [...dias].sort((a, b) => a - b);
  const name = (d) => DIAS_SEMANA[d];
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (sorted.length === 1) return name(sorted[0]);
  if (consecutive && sorted.length > 2) return `${name(sorted[0])} a ${name(sorted.at(-1)).toLowerCase()}`;
  const names = sorted.map((d, i) => (i === 0 ? name(d) : name(d).toLowerCase()));
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

/** Filas del horario general por día (1..7) para tablas: [{ dia, label, apertura, cierre }]. */
export function weeklyHours(center) {
  return [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const g = hoursForWeekday(center, d);
    return { dia: d, label: DIAS_SEMANA[d], apertura: g?.apertura || null, cierre: g?.cierre || null };
  });
}

/**
 * Agrupa un horario por día (editor del panel) en el formato del modelo:
 * [{ dia, abierto, apertura, cierre }] → [{ dias: [..], apertura, cierre }]
 */
export function groupWeeklyHours(rows) {
  const groups = [];
  for (const r of rows.filter((x) => x.abierto)) {
    const g = groups.find((x) => x.apertura === r.apertura && x.cierre === r.cierre);
    if (g) g.dias.push(r.dia);
    else groups.push({ dias: [r.dia], apertura: r.apertura, cierre: r.cierre });
  }
  return groups;
}
