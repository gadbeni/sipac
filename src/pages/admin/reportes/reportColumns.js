/**
 * Columnas del reporte, compartidas por las tablas en pantalla/impresión y por el CSV.
 * `format` es para mostrar; el CSV usa el valor crudo (`value` o la clave) con coma decimal.
 */
import { formatDate, formatDateTime } from '@/utils/dates';
import { toCsv } from '@/utils/csv';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const num = (v) => (typeof v === 'number' ? v.toLocaleString('es-BO') : '—');
export const fmtPct = (v) => (v == null ? '—' : `${v.toLocaleString('es-BO')} %`);
export const fmtMin = (v) => (v == null ? '—' : `${v} min`);

/** "2026-11" → "noviembre 2026"; "2026-11-06" → "06/11/2026". */
export const periodLabel = (p, granularidad) =>
  granularidad === 'mes' ? `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}` : formatDate(p);
/** Etiqueta corta para el eje: "06/11" o "nov 2026". */
export const periodTick = (p, granularidad) =>
  granularidad === 'mes'
    ? `${MESES[Number(p.slice(5, 7)) - 1].slice(0, 3)} ${p.slice(2, 4)}`
    : formatDate(p).slice(0, 5);

const n = (key, label) => ({ key, label, align: 'right', format: num });
const AUS = { key: 'ausentismoPct', label: 'Ausentismo (%)', align: 'right', format: fmtPct };
const ESP = { key: 'esperaPromedioMin', label: 'Espera promedio (min)', align: 'right', format: fmtMin };

export const COLUMNS = {
  serie: (gran) => [
    {
      key: 'periodo',
      label: gran === 'mes' ? 'Mes' : 'Fecha',
      value: (r) => periodLabel(r.periodo, gran),
      format: (_v, r) => periodLabel(r.periodo, gran),
    },
    n('emitidas', 'Emitidas'),
    n('atendidas', 'Atendidas'),
    n('ausentes', 'Ausentes'),
    n('canceladas', 'Canceladas'),
    AUS,
  ],
  porCentro: [
    { key: 'centro', label: 'Centro', format: (v, r) => (r.activo ? v : `${v} (inactivo)`) },
    n('emitidas', 'Emitidas'),
    n('atendidas', 'Atendidas'),
    n('ausentes', 'Ausentes'),
    AUS,
    n('canceladas', 'Canceladas'),
    n('solicitudes', 'Solicitudes'),
    n('rechazadas', 'Rechazadas'),
    ESP,
  ],
  porEspecialidad: [
    { key: 'especialidad', label: 'Especialidad' },
    n('demanda', 'Demanda'),
    n('solicitudes', 'Solicitudes web'),
    n('ventanilla', 'Ventanilla'),
    n('emitidas', 'Emitidas'),
    n('atendidas', 'Atendidas'),
    n('ausentes', 'Ausentes'),
    AUS,
    ESP,
  ],
  porMedico: [
    { key: 'medico', label: 'Médico' },
    n('emitidas', 'Emitidas'),
    n('atendidas', 'Atendidas'),
    n('ausentes', 'Ausentes'),
    AUS,
    ESP,
  ],
};

/** Indicadores del resumen (KPI y primera sección del CSV). */
export const SUMMARY = [
  ['emitidas', 'Fichas emitidas', num],
  ['atendidas', 'Fichas atendidas', num],
  ['ausentes', 'Pacientes ausentes', num],
  ['ausentismoPct', 'Ausentismo (%)', fmtPct],
  ['canceladas', 'Fichas canceladas', num],
  ['reprogramadas', 'Fichas reprogramadas', num],
  ['ventanilla', 'Fichas de ventanilla', num],
  ['solicitudes', 'Solicitudes registradas', num],
  ['rechazadas', 'Solicitudes rechazadas', num],
  ['vencidas', 'Solicitudes vencidas', num],
  ['esperaPromedioMin', 'Espera promedio (min)', fmtMin],
];

/** CSV completo del reporte, con encabezado institucional y filtros aplicados. */
export function reportCsv(r, institution) {
  const e = r.filtros.etiquetas;
  const gran = r.serie.granularidad;
  const sections = [
    {
      lines: [
        ['Reporte de fichas médicas'],
        ['Institución', institution],
        ['Centro', e.centro],
        ['Período', `${formatDate(r.filtros.desde)} al ${formatDate(r.filtros.hasta)}`],
        ['Especialidad', e.especialidad],
        ['Médico', e.medico],
        ['Generado', formatDateTime(r.generadoEn)],
        ['Aviso', 'Prototipo de demostración: datos ficticios.'],
      ],
    },
    {
      title: 'Resumen',
      columns: [
        { key: 'label', label: 'Indicador' },
        { key: 'value', label: 'Valor' },
      ],
      rows: SUMMARY.map(([k, label]) => ({ label, value: r.resumen[k] })),
    },
  ];
  if (r.porCentro) sections.push({ title: 'Por centro', columns: COLUMNS.porCentro, rows: r.porCentro });
  sections.push(
    { title: gran === 'mes' ? 'Por mes' : 'Por día', columns: COLUMNS.serie(gran), rows: r.serie.filas },
    { title: 'Por especialidad', columns: COLUMNS.porEspecialidad, rows: r.porEspecialidad },
    { title: 'Por médico', columns: COLUMNS.porMedico, rows: r.porMedico },
  );
  return toCsv(sections);
}

export const csvFilename = (r) =>
  `sipac-reporte-${r.filtros.etiquetas.centroCodigo}-${r.filtros.desde}_${r.filtros.hasta}.csv`;
