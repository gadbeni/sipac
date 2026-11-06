/**
 * Insights del dashboard (BUSINESS_RULES §10): reglas sobre los KPIs. Solo se devuelven los
 * que aplican, ordenados por severidad. Cada uno tiene `id` estable para pruebas.
 */
import { DIAS_SEMANA } from '@/config/constants';
import { addDays, formatDate } from '@/utils/dates';
import { getPublicAvailability } from './availability';
import { demandBySpecialty, occupancyBySpecialty, requestsByWeekday } from './kpis';

const ORDER = { error: 0, warning: 1, success: 2, info: 3 };
export const UMBRAL_AUSENTISMO = 15;
export const UMBRAL_CUPOS_LIBRES = 0.2;

export function computeInsights(snap, scope, { today, now, kpis }) {
  const out = [];
  const manana = addDays(today, 1);

  if (kpis.pendientesHoyManana > 0) {
    out.push({
      id: 'pendientes',
      severity: 'warning',
      title: `${kpis.pendientesHoyManana} ${kpis.pendientesHoyManana === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} para hoy y mañana`,
      text: 'Revíselas pronto: los ciudadanos esperan la confirmación para presentarse.',
      link: { to: '/admin/solicitudes?tab=pendientes', label: 'Revisar solicitudes' },
    });
  }

  if (kpis.ausentismoPct != null && kpis.cerradasSemana >= 10 && kpis.ausentismoPct > UMBRAL_AUSENTISMO) {
    out.push({
      id: 'ausentismo',
      severity: 'error',
      title: `Ausentismo alto: ${kpis.ausentismoPct.toLocaleString('es-BO')} % en los últimos 7 días`,
      text: `${kpis.ausentesSemana} de ${kpis.cerradasSemana} pacientes con ficha no se presentaron (umbral ${UMBRAL_AUSENTISMO} %). Los pacientes ausentes quedan bloqueados hasta su habilitación.`,
      link: { to: '/admin/pacientes?bloqueados=1', label: 'Ver pacientes bloqueados' },
    });
  }

  for (const [fecha, label] of [
    [today, 'hoy'],
    [manana, 'mañana'],
  ]) {
    const escasas = occupancyBySpecialty(snap, scope, { fecha }).filter(
      (r) => r.libres / r.cupos < UMBRAL_CUPOS_LIBRES,
    );
    if (escasas.length) {
      out.push({
        id: `cupos-${label}`,
        severity: 'warning',
        title: `Pocos cupos libres ${label} en ${escasas.map((e) => e.especialidad).join(', ')}`,
        text: escasas.map((e) => `${e.especialidad}: ${e.libres} de ${e.cupos} libres`).join(' · '),
        link: { to: `/admin/agenda?fecha=${fecha}`, label: 'Ver agenda' },
      });
    }
  }

  // Lista de espera con cupos disponibles (RN-SOL-11): se puede aprobar.
  const espera = snap.solicitudes.filter(
    (s) =>
      s.estado === 'lista_espera' &&
      s.fechaSolicitada >= today &&
      (!scope.centroId || s.centroId === scope.centroId),
  );
  const conCupo = espera.filter(
    (s) =>
      getPublicAvailability(snap, {
        centroId: s.centroId,
        especialidadId: s.especialidadId,
        fecha: s.fechaSolicitada,
        now,
      }).publicosLibres > 0,
  );
  if (conCupo.length) {
    out.push({
      id: 'lista-espera',
      severity: 'success',
      title: `Hay cupos para ${conCupo.length} ${conCupo.length === 1 ? 'solicitud' : 'solicitudes'} en lista de espera`,
      text: `Se liberaron cupos en fechas con solicitudes en espera (${[...new Set(conCupo.map((s) => formatDate(s.fechaSolicitada)))].join(', ')}).`,
      link: { to: '/admin/solicitudes?tab=lista_espera', label: 'Ver lista de espera' },
    });
  }

  const demanda = demandBySpecialty(snap, scope, { today });
  if (demanda.length && demanda[0].total >= 3) {
    const total = demanda.reduce((s, d) => s + d.total, 0);
    out.push({
      id: 'demanda',
      severity: 'info',
      title: `${demanda[0].especialidad} concentra la mayor demanda`,
      text: `${demanda[0].total} de ${total} pedidos de los últimos 7 días (${Math.round((demanda[0].total / total) * 100)} %).`,
    });
  }

  const porDia = requestsByWeekday(snap, scope, { today });
  const max = Math.max(...porDia);
  if (max >= 5) {
    const dia = porDia.indexOf(max);
    out.push({
      id: 'dia-pico',
      severity: 'info',
      title: `Los ${DIAS_SEMANA[dia].toLowerCase()} se reciben más solicitudes`,
      text: `${max} solicitudes en ese día de la semana durante las últimas 4 semanas. Considere reforzar la revisión.`,
    });
  }

  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
