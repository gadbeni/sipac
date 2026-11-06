/**
 * Inicialización de datos de demostración (RN-DEM-01).
 * Único módulo autorizado a leer src/data/*.json (regla ESLint no-restricted-imports).
 */
import centros from '@/data/centros.json';
import consultorios from '@/data/consultorios.json';
import especialidades from '@/data/especialidades.json';
import centroEspecialidades from '@/data/centroEspecialidades.json';
import medicos from '@/data/medicos.json';
import medicoCentros from '@/data/medicoCentros.json';
import horarios from '@/data/horarios.json';
import agendas from '@/data/agendas.json';
import pacientes from '@/data/pacientes.json';
import solicitudes from '@/data/solicitudes.json';
import fichas from '@/data/fichas.json';
import usuarios from '@/data/usuarios.json';
import notificaciones from '@/data/notificaciones.json';
import escenario from '@/data/escenario.json';

import { appConfig } from '@/config/app.config';
import { needsSeed, refreshDemoData } from './refreshDemoData';
import { today, currentTime, nowIso } from '@/utils/dates';
import { resolveDeep } from './resolveRelative';
import { generateActivity } from './activityGenerator';
import { validateIntegrity } from '../rules/integrity';

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Construye el conjunto completo de datos relativo a la fecha/hora actual (sin persistir). */
export function buildDemoData({ date = today(), time = currentTime(), iso = nowIso() } = {}) {
  const ctx = { today: date, nowIso: iso };
  const base = {
    centros: clone(centros),
    consultorios: clone(consultorios),
    especialidades: clone(especialidades),
    centroEspecialidades: clone(centroEspecialidades),
    medicos: clone(medicos),
    medicoCentros: clone(medicoCentros),
    horarios: clone(horarios),
    excepcionesAgenda: resolveDeep(agendas, ctx),
    pacientes: clone(pacientes),
    solicitudes: resolveDeep(solicitudes, ctx),
    fichas: resolveDeep(fichas, ctx),
    usuarios: clone(usuarios),
    notificaciones: resolveDeep(notificaciones, ctx),
  };
  return generateActivity(base, { today: date, nowTime: time, nowIso: iso, escenario });
}

/** Borra los datos y vuelve a sembrar. Devuelve resumen y errores de integridad. */
export function seedDemoData(ds, clock) {
  const data = buildDemoData(clock);
  const errors = validateIntegrity(data);
  if (errors.length) console.error('[seed] errores de integridad:', errors);
  ds.clearAll();
  ds.replaceAll(data, { force: true });
  const meta = {
    schemaVersion: appConfig.data.schemaVersion,
    sembradoEn: clock?.iso || nowIso(),
    fechaBase: clock?.date || today(),
    semilla: escenario.semilla,
    erroresIntegridad: errors.length,
  };
  ds.setMeta(meta);
  return { meta, errors, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) };
}

/**
 * Garantiza que existan datos. Si ya existen, aplica las transiciones por paso del tiempo
 * (vencimientos, cierre de jornadas pasadas) de forma perezosa (ARCHITECTURE R7).
 */
export function ensureDemoData(ds, clock) {
  if (needsSeed(ds)) return { seeded: true, ...seedDemoData(ds, clock) };
  return refreshDemoData(ds, clock);
}
