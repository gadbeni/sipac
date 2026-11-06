/**
 * Mantenimiento de los datos ya sembrados, sin cargar los JSON semilla (paquete inicial liviano).
 */
import { appConfig } from '@/config/app.config';
import { applyTimeTransitions } from '../rules/timeTransitions';
import { nowIso, today } from '@/utils/dates';

/** ¿Hace falta sembrar? (primer uso o cambio de versión del esquema). */
export const needsSeed = (ds) => {
  const meta = ds.getMeta();
  return !meta || meta.schemaVersion !== appConfig.data.schemaVersion;
};

/** Cierra jornadas pasadas y vence solicitudes (R7). */
export function refreshDemoData(ds, clock) {
  const stats = (ds.raw || ds).transaction(
    ['solicitudes', 'fichas', 'pacientes'],
    (tx) => applyTimeTransitions(tx, { today: clock?.date || today(), nowIso: clock?.iso || nowIso() }),
    { force: true },
  );
  return { seeded: false, meta: ds.getMeta(), stats };
}
