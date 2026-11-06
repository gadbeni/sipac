/** Médicos (portal). La gestión de médicos se agrega en la Épica 9. */
import { delay } from './repositories/createRepository';
import { portalSnapshot, nowLocal } from './portalSnapshot';
import { doctorsOnDuty } from './rules/portal';

export const doctorService = {
  /** Médicos con atención efectiva en la fecha (horarios + excepciones). */
  async getDoctorsOnDuty(centroId, fecha) {
    await delay();
    if (!centroId) return [];
    const now = nowLocal();
    return doctorsOnDuty(portalSnapshot(), centroId, fecha || now.date, now);
  },
};
