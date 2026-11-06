/** Especialidades del centro para el portal (RN-ESP-02, RN-DIS-01). */
import { delay } from './repositories/createRepository';
import { portalSnapshot, nowLocal } from './portalSnapshot';
import { centerSpecialties } from './rules/portal';

export const specialtyService = {
  async getCenterSpecialties(centroId) {
    await delay();
    if (!centroId) return [];
    return centerSpecialties(portalSnapshot(), centroId, nowLocal());
  },
};
