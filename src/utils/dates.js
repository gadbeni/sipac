/**
 * Utilidades de fecha en zona America/La_Paz.
 *
 * Convenciones (DATA_MODEL §2):
 *  - Día:        'YYYY-MM-DD'  (calendario local de La Paz)
 *  - Hora:       'HH:mm'
 *  - Fecha-hora: ISO con offset, p. ej. '2026-11-05T08:15:00-04:00'
 *
 * La aritmética de días se hace sobre fechas de calendario (en UTC puro) para que no dependa
 * de la zona horaria del equipo. "Ahora" siempre se interpreta en America/La_Paz.
 * El reloj es reemplazable (setClock) para pruebas y para el generador de datos.
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/es';
import { appConfig } from '@/config/app.config';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.locale('es');

export const TZ = appConfig.locale.timezone;
export const OFFSET = appConfig.locale.utcOffset;

let clock = () => Date.now();

/** Reemplaza el reloj (milisegundos epoch). Llamar sin argumentos para restaurar. */
export function setClock(fn) {
  clock = typeof fn === 'function' ? fn : () => Date.now();
}

/** Instante actual en America/La_Paz (objeto dayjs). */
export const now = () => dayjs(clock()).tz(TZ);

/** Fecha-hora ISO actual con offset de La Paz. */
export const nowIso = () => now().format('YYYY-MM-DDTHH:mm:ssZ');

/** Día de hoy en La Paz ('YYYY-MM-DD'). */
export const today = () => now().format('YYYY-MM-DD');

/** Hora actual en La Paz ('HH:mm'). */
export const currentTime = () => now().format('HH:mm');

const cal = (dateStr) => dayjs.utc(dateStr, 'YYYY-MM-DD', true);

export const isValidDate = (dateStr) => typeof dateStr === 'string' && cal(dateStr).isValid();

export const addDays = (dateStr, n) => cal(dateStr).add(n, 'day').format('YYYY-MM-DD');

/** Diferencia en días de calendario: b − a. */
export const diffDays = (a, b) => cal(b).diff(cal(a), 'day');

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export const isoWeekday = (dateStr) => {
  const d = cal(dateStr).day();
  return d === 0 ? 7 : d;
};

export const compareDates = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Lista de días entre from y to, inclusive. */
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------- Horas
export const timeToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const addMinutesToTime = (hhmm, mins) => minutesToTime(timeToMinutes(hhmm) + mins);

/** ¿Se solapan los intervalos [aStart, aEnd) y [bStart, bEnd)? (horas 'HH:mm') */
export const timeRangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);

// ---------------------------------------------------------------- Fecha-hora
/** Construye fecha-hora ISO de La Paz a partir de día y hora. */
export const toIso = (dateStr, hhmm = '00:00') => `${dateStr}T${hhmm}:00${OFFSET}`;

export const parseIso = (iso) => dayjs(iso).tz(TZ);

/** Suma minutos a una fecha-hora ISO y devuelve ISO de La Paz. */
export const addMinutesIso = (iso, mins) => parseIso(iso).add(mins, 'minute').format('YYYY-MM-DDTHH:mm:ssZ');

/** Minutos entre dos fecha-hora ISO (b − a). */
export const diffMinutesIso = (a, b) => dayjs(b).diff(dayjs(a), 'minute');

/** Día de calendario (La Paz) de una fecha-hora ISO. */
export const isoToDate = (iso) => parseIso(iso).format('YYYY-MM-DD');

// ---------------------------------------------------------------- Formato de presentación
export const formatDate = (dateStr) => (dateStr ? cal(dateStr).format(appConfig.locale.dateFormat) : '');

export const formatDateLong = (dateStr) =>
  dateStr ? cal(dateStr).locale('es').format('dddd D [de] MMMM [de] YYYY') : '';

export const formatDateTime = (iso) =>
  iso ? parseIso(iso).format(`${appConfig.locale.dateFormat} HH:mm`) : '';

export const formatTime = (hhmmOrIso) => {
  if (!hhmmOrIso) return '';
  return hhmmOrIso.length <= 5 ? hhmmOrIso : parseIso(hhmmOrIso).format('HH:mm');
};

/** Convierte 'DD/MM/YYYY' a 'YYYY-MM-DD' (null si es inválida). */
export const parseDisplayDate = (ddmmyyyy) => {
  const d = dayjs.utc(ddmmyyyy, appConfig.locale.dateFormat, true);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
};

/** Edad en años cumplidos a la fecha de referencia. */
export const ageAt = (birthDate, refDate = today()) => cal(refDate).diff(cal(birthDate), 'year');

export { dayjs };

/** "hace 5 min", "hace 2 h", "ayer 14:30" o fecha y hora. */
export function formatRelative(iso, ref = nowIso()) {
  if (!iso) return '';
  const m = diffMinutesIso(iso, ref);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  if (m < 24 * 60 && isoToDate(iso) === isoToDate(ref)) return `hace ${Math.floor(m / 60)} h`;
  if (isoToDate(iso) === addDays(isoToDate(ref), -1)) return `ayer ${formatTime(iso)}`;
  return formatDateTime(iso);
}
