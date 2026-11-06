/**
 * Dashboard (Épica 7) y reportes por rango de fechas (Épica 12).
 * El alcance sale de la sesión: centro activo (o todos para el admin central) y, para el
 * médico, solo sus fichas.
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { assertPermission, can, scopeCenter } from './auth/guards';
import { PORTAL_COLLECTIONS, nowLocal } from './portalSnapshot';
import {
  computeKpis,
  demandBySpecialty,
  distributionByHour,
  issuedVsAttended,
  requestsByDay,
} from './rules/kpis';
import { computeInsights } from './rules/insights';
import { buildReport, MAX_RANGO_DIAS } from './rules/reports';
import { doctorName } from './rules/portal';
import { AppError } from './errors';
import { COLLECTIONS as C } from '@/config/constants';
import { addDays, diffDays, isValidDate, nowIso, timeToMinutes, today as todayStr } from '@/utils/dates';

const REPORT_COLLECTIONS = [C.centros, C.especialidades, C.medicos, C.medicoCentros, C.fichas, C.solicitudes];

/** Centro del reporte: 'todos' (solo con `reportes.global`), un centro o el activo de la sesión. */
function reportCenter(session, centroId) {
  if (centroId === 'todos' || (centroId == null && session.activeCenterId == null)) {
    assertPermission(session, 'reportes.global');
    return null;
  }
  return scopeCenter(session, centroId || session.activeCenterId);
}

/** Período por defecto: últimos 30 días incluyendo hoy. */
export const defaultReportRange = (hoy = todayStr()) => ({ desde: addDays(hoy, -29), hasta: hoy });

function validateRange({ desde, hasta }) {
  const fields = {};
  if (!isValidDate(desde)) fields.desde = 'Fecha inválida.';
  if (!isValidDate(hasta)) fields.hasta = 'Fecha inválida.';
  if (!Object.keys(fields).length) {
    if (desde > hasta) fields.hasta = 'Debe ser igual o posterior a “Desde”.';
    else if (diffDays(desde, hasta) + 1 > MAX_RANGO_DIAS)
      fields.hasta = `El período no puede superar ${MAX_RANGO_DIAS} días.`;
  }
  if (Object.keys(fields).length) throw new AppError('VALIDACION', Object.values(fields)[0], { fields });
}

export const DASHBOARD_COLLECTIONS = [...new Set([...PORTAL_COLLECTIONS, C.pacientes])];

export const reportService = {
  async getDashboard(session) {
    await delay();
    assertPermission(session, 'dashboard.ver');
    const centroId = scopeCenter(session);
    const medicoId = session.rol === 'medico' ? session.medicoId : undefined;
    const scope = { centroId, medicoId };
    const snap = getDataSource().snapshot(DASHBOARD_COLLECTIONS);
    const now = nowLocal();
    const today = now.date;
    const kpis = computeKpis(snap, scope, { today });
    const centro = centroId ? snap.centros.find((c) => c.id === centroId) : null;
    const base = {
      scope,
      today,
      centro: centro ? { id: centro.id, nombre: centro.nombre, activo: centro.activo } : null,
      kpis,
    };

    if (medicoId) {
      const esp = new Map(snap.especialidades.map((e) => [e.id, e.nombre]));
      const pac = new Map(snap.pacientes.map((p) => [p.id, p]));
      const cons = new Map(snap.consultorios.map((x) => [x.id, x.nombre]));
      const agenda = snap.fichas
        .filter(
          (f) =>
            f.fecha === today &&
            f.medicoId === medicoId &&
            f.centroId === centroId &&
            !['cancelada', 'reprogramada'].includes(f.estado),
        )
        .sort((a, b) => timeToMinutes(a.horaEstimada) - timeToMinutes(b.horaEstimada) || a.numero - b.numero)
        .map((f) => {
          const p = pac.get(f.pacienteId);
          return {
            id: f.id,
            codigo: f.codigoVisible,
            hora: f.horaEstimada,
            estado: f.estado,
            prioridad: f.prioridad,
            especialidad: esp.get(f.especialidadId),
            consultorio: cons.get(f.consultorioId),
            paciente: p ? `${p.nombres} ${p.apellidos}` : '—',
          };
        });
      return {
        ...base,
        vista: 'medico',
        agenda,
        emitidasVsAtendidas: issuedVsAttended(snap, scope, { today }),
      };
    }

    return {
      ...base,
      vista: centroId ? 'centro' : 'global',
      insights: computeInsights(snap, scope, { today, now, kpis }),
      solicitudesPorDia: requestsByDay(snap, scope, { today }),
      demanda: demandBySpecialty(snap, scope, { today }),
      emitidasVsAtendidas: issuedVsAttended(snap, scope, { today }),
      porFranja: distributionByHour(snap, scope, { fecha: today }),
      porCentro: centroId
        ? null
        : snap.centros
            .filter((c) => c.activo)
            .map((c) => ({
              id: c.id,
              nombre: c.nombre,
              ...computeKpis(snap, { centroId: c.id }, { today }),
            })),
    };
  },

  // ------------------------------------------------------------------ Reportes (Épica 12)
  /** Opciones de los filtros: centros visibles, especialidades y médicos del centro elegido. */
  async getReportOptions(session, { centroId } = {}) {
    await delay(0);
    assertPermission(session, 'reportes.ver');
    const global = can(session, 'reportes.global');
    const centro = reportCenter(session, centroId);
    const snap = getDataSource().snapshot(REPORT_COLLECTIONS);
    const centros = snap.centros
      .filter((c) => global || (session.centrosPermitidos || []).includes(c.id))
      .map((c) => ({ id: c.id, nombre: c.nombre, codigoCorto: c.codigoCorto, activo: c.activo }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const vinculos = snap.medicoCentros.filter((v) => !centro || v.centroId === centro);
    const medIds = new Set([
      ...vinculos.map((v) => v.medicoId),
      ...snap.fichas.filter((f) => !centro || f.centroId === centro).map((f) => f.medicoId),
    ]);
    return {
      global,
      centroId: centro,
      centros,
      especialidades: snap.especialidades
        .map((e) => ({ id: e.id, nombre: e.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      medicos: snap.medicos
        .filter((m) => medIds.has(m.id))
        .map((m) => ({
          id: m.id,
          nombre: doctorName(m),
          especialidadIds: [
            ...new Set(vinculos.filter((v) => v.medicoId === m.id).flatMap((v) => v.especialidadIds || [])),
          ],
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    };
  },

  /** Reporte filtrado: `{ centroId|'todos', desde, hasta, especialidadId, medicoId }`. */
  async getReport(session, filtros = {}) {
    await delay();
    assertPermission(session, 'reportes.ver');
    const centroId = reportCenter(session, filtros.centroId);
    const { desde, hasta } = { ...defaultReportRange(), ...pickDefined(filtros, ['desde', 'hasta']) };
    validateRange({ desde, hasta });
    const especialidadId = filtros.especialidadId || null;
    const medicoId = filtros.medicoId || null;
    const snap = getDataSource().snapshot(REPORT_COLLECTIONS);
    const centro = centroId ? snap.centros.find((c) => c.id === centroId) : null;
    const esp = especialidadId ? snap.especialidades.find((e) => e.id === especialidadId) : null;
    const med = medicoId ? snap.medicos.find((m) => m.id === medicoId) : null;
    return {
      filtros: {
        centroId,
        desde,
        hasta,
        especialidadId,
        medicoId,
        etiquetas: {
          centro: centro ? centro.nombre : 'Todos los centros',
          centroCodigo: centro ? centro.codigoCorto : 'TODOS',
          especialidad: esp ? esp.nombre : 'Todas',
          medico: med ? doctorName(med) : 'Todos',
        },
      },
      generadoEn: nowIso(),
      generadoPor: session.nombre || null,
      ...buildReport(snap, { centroId, desde, hasta, especialidadId, medicoId }),
    };
  },
};

function pickDefined(o, keys) {
  return Object.fromEntries(keys.filter((k) => o[k]).map((k) => [k, o[k]]));
}
