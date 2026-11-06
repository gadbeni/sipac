/** Horarios y resumen del día para el portal. */
import { delay } from './repositories/createRepository';
import { portalSnapshot, nowLocal } from './portalSnapshot';
import { centerSchedule, centerSpecialties, doctorsOnDuty } from './rules/portal';
import { openStatus } from './rules/centers';

export const scheduleService = {
  async getCenterSchedule(centroId) {
    await delay();
    if (!centroId) return null;
    return centerSchedule(portalSnapshot(), centroId, nowLocal());
  },

  /** Resumen para la portada: apertura, médicos de turno, fichas web libres hoy. */
  async getDaySummary(centroId) {
    await delay();
    if (!centroId) return null;
    const snap = portalSnapshot();
    const now = nowLocal();
    const center = snap.centros.find((c) => c.id === centroId);
    if (!center) return null;
    const esps = centerSpecialties(snap, centroId, now);
    const medicos = doctorsOnDuty(snap, centroId, now.date, now);
    return {
      apertura: openStatus(center, now.date, now.time, snap.excepcionesAgenda),
      medicosHoy: medicos.length,
      medicosAhora: medicos.filter((m) => m.estado === 'en_turno').length,
      fichasWebHoy: esps.reduce((s, e) => s + e.hoy.publicosLibres, 0),
      especialidadesConFichasHoy: esps.filter((e) => e.hoy.publicosLibres > 0).length,
      especialidades: esps.length,
    };
  },
};
