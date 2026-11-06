/**
 * Reportes por rango de fechas (Épica 12). Funciones puras sobre un snapshot, con las mismas
 * definiciones que el dashboard (BUSINESS_RULES §10), para que los totales coincidan:
 *  - Fichas: por fecha de atención (`fecha`). Emitidas = estado ≠ cancelada/reprogramada.
 *  - Ausentismo = ausente / (atendida + ausente). Espera = inicioAtencionEn − llegadaEn.
 *  - Solicitudes: por fecha de registro (`creadoEn`), con su estado actual.
 * `filtros = { centroId|null, especialidadId?, medicoId?, desde, hasta }` (fechas YYYY-MM-DD).
 */
import { dateRange, diffMinutesIso, isoToDate } from '@/utils/dates';
import { doctorName } from './portal';

export const MAX_RANGO_DIAS = 366;
/** Hasta este largo se agrupa por día; más largo, por mes. */
export const MAX_DIAS_SERIE_DIARIA = 62;
const NO_EMITIDA = new Set(['cancelada', 'reprogramada']);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Indicadores de un conjunto de fichas y solicitudes. */
export function metrics(fichas, solicitudes = []) {
  const count = (e) => fichas.filter((f) => f.estado === e).length;
  const emitidas = fichas.filter((f) => !NO_EMITIDA.has(f.estado));
  const atendidas = count('atendida');
  const ausentes = count('ausente');
  const esperas = fichas
    .filter((f) => f.estado === 'atendida' && f.llegadaEn && f.inicioAtencionEn)
    .map((f) => diffMinutesIso(f.llegadaEn, f.inicioAtencionEn))
    .filter((m) => m >= 0);
  const sol = (e) => solicitudes.filter((s) => s.estado === e).length;
  const ventanilla = emitidas.filter((f) => f.canal === 'ventanilla').length;
  return {
    emitidas: emitidas.length,
    web: emitidas.length - ventanilla,
    ventanilla,
    atendidas,
    ausentes,
    canceladas: count('cancelada'),
    reprogramadas: count('reprogramada'),
    cerradas: atendidas + ausentes,
    ausentismoPct: pct(ausentes, atendidas + ausentes),
    esperaPromedioMin: avg(esperas),
    solicitudes: solicitudes.length,
    rechazadas: sol('rechazada'),
    rechazoPct: pct(sol('rechazada'), solicitudes.length),
    vencidas: sol('vencida'),
    solicitudesCanceladas: sol('cancelada'),
    listaEspera: sol('lista_espera'),
  };
}

function groupBy(items, key) {
  const m = new Map();
  for (const x of items) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/** Fichas y solicitudes del alcance y período. */
export function selectRecords(snap, { centroId, especialidadId, medicoId, desde, hasta }) {
  const base = (x) =>
    (!centroId || x.centroId === centroId) && (!especialidadId || x.especialidadId === especialidadId);
  const fichas = snap.fichas.filter(
    (f) => base(f) && (!medicoId || f.medicoId === medicoId) && f.fecha >= desde && f.fecha <= hasta,
  );
  const medicoDeFicha = new Map(snap.fichas.map((f) => [f.id, f.medicoId]));
  const solicitudes = snap.solicitudes.filter((s) => {
    if (!base(s)) return false;
    const d = isoToDate(s.creadoEn);
    if (d < desde || d > hasta) return false;
    // Con filtro de médico: la solicitud cuenta si su ficha es de ese médico o lo prefirió.
    return !medicoId || medicoDeFicha.get(s.fichaId) === medicoId || s.medicoPreferidoId === medicoId;
  });
  return { fichas, solicitudes };
}

/** Serie temporal (día o mes según el largo del período), con todos los períodos. */
export function periodSeries(fichas, { desde, hasta }) {
  const dias = dateRange(desde, hasta);
  const mensual = dias.length > MAX_DIAS_SERIE_DIARIA;
  const keyOf = (fecha) => (mensual ? fecha.slice(0, 7) : fecha);
  const periodos = [...new Set(dias.map(keyOf))];
  const by = groupBy(fichas, (f) => keyOf(f.fecha));
  return {
    granularidad: mensual ? 'mes' : 'dia',
    filas: periodos.map((p) => {
      const m = metrics(by.get(p) || []);
      return {
        periodo: p,
        emitidas: m.emitidas,
        atendidas: m.atendidas,
        ausentes: m.ausentes,
        canceladas: m.canceladas,
        ausentismoPct: m.ausentismoPct,
      };
    }),
  };
}

/** Reporte completo. */
export function buildReport(snap, filtros) {
  const { fichas, solicitudes } = selectRecords(snap, filtros);
  const esp = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
  const med = new Map(snap.medicos.map((m) => [m.id, m]));
  const fichasEsp = groupBy(fichas, (f) => f.especialidadId);
  const solsEsp = groupBy(solicitudes, (s) => s.especialidadId);

  const porEspecialidad = [...new Set([...fichasEsp.keys(), ...solsEsp.keys()])]
    .map((id) => {
      const m = metrics(fichasEsp.get(id) || [], solsEsp.get(id) || []);
      // Demanda = solicitudes registradas + fichas de ventanilla (misma definición que el dashboard).
      return {
        especialidadId: id,
        especialidad: esp.get(id) || id,
        ...m,
        demanda: m.solicitudes + m.ventanilla,
      };
    })
    .sort((a, b) => b.demanda - a.demanda || a.especialidad.localeCompare(b.especialidad, 'es'));

  const porMedico = [...groupBy(fichas, (f) => f.medicoId).entries()]
    .map(([id, fs]) => ({
      medicoId: id,
      medico: med.get(id) ? doctorName(med.get(id)) : '—',
      ...metrics(fs),
    }))
    .sort((a, b) => b.emitidas - a.emitidas || a.medico.localeCompare(b.medico, 'es'));

  let porCentro = null;
  if (!filtros.centroId) {
    const fc = groupBy(fichas, (f) => f.centroId);
    const sc = groupBy(solicitudes, (s) => s.centroId);
    porCentro = snap.centros
      .filter((c) => c.activo || fc.has(c.id) || sc.has(c.id))
      .map((c) => ({
        centroId: c.id,
        centro: c.nombre,
        activo: c.activo,
        ...metrics(fc.get(c.id) || [], sc.get(c.id) || []),
      }))
      .sort((a, b) => a.centro.localeCompare(b.centro, 'es'));
  }

  const fechas = snap.fichas.map((f) => f.fecha).sort();
  return {
    resumen: metrics(fichas, solicitudes),
    serie: periodSeries(fichas, filtros),
    porEspecialidad,
    porMedico,
    porCentro,
    datosDesde: fechas[0] || null,
  };
}
