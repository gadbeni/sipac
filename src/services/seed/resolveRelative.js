/**
 * Resolución de fechas relativas en los JSON de escenario (DATA_MODEL §6).
 *
 *   '@d+1'          → día de calendario (hoy + 1)                'YYYY-MM-DD'
 *   '@d-5T09:10'    → fecha-hora ese día a esa hora               ISO con offset
 *   '@now-20m'      → ahora − 20 minutos (unidades m, h, d)       ISO con offset
 */
import { addDays, toIso, addMinutesIso } from '@/utils/dates';

const RE_DAY = /^@d([+-]\d+)$/;
const RE_DAY_TIME = /^@d([+-]\d+)T(\d{2}:\d{2})$/;
const RE_NOW = /^@now([+-]\d+)([mhd])$/;
const UNIT = { m: 1, h: 60, d: 1440 };

export function resolveToken(value, { today, nowIso }) {
  if (typeof value !== 'string' || value[0] !== '@') return value;
  let m;
  if ((m = RE_DAY.exec(value))) return addDays(today, Number(m[1]));
  if ((m = RE_DAY_TIME.exec(value))) return toIso(addDays(today, Number(m[1])), m[2]);
  if ((m = RE_NOW.exec(value))) return addMinutesIso(nowIso, Number(m[1]) * UNIT[m[2]]);
  return value;
}

export function resolveDeep(value, ctx) {
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, ctx));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveDeep(v, ctx)]));
  }
  return resolveToken(value, ctx);
}
