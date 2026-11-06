/** Colecciones que necesitan los cálculos del portal. */
import { getDataSource } from './datasource';
import { COLLECTIONS as C } from '@/config/constants';
import { currentTime, today } from '@/utils/dates';

export const PORTAL_COLLECTIONS = [
  C.centros,
  C.centroEspecialidades,
  C.especialidades,
  C.horarios,
  C.medicos,
  C.medicoCentros,
  C.excepcionesAgenda,
  C.consultorios,
  C.fichas,
  C.solicitudes,
];

export const portalSnapshot = () => getDataSource().snapshot(PORTAL_COLLECTIONS);
export const nowLocal = () => ({ date: today(), time: currentTime() });
