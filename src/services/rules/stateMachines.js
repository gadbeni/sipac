/**
 * Máquinas de estado de Solicitud y Ficha (BUSINESS_RULES §6.2 y §7.1).
 */
import { AppError } from '../errors';
import { ESTADOS_VISIBLES } from '@/config/constants';

export const SOLICITUD_TRANSICIONES = Object.freeze({
  pendiente: {
    aprobar: 'aprobada',
    a_lista_espera: 'lista_espera',
    rechazar: 'rechazada',
    cancelar: 'cancelada',
    vencer: 'vencida',
  },
  lista_espera: { aprobar: 'aprobada', rechazar: 'rechazada', cancelar: 'cancelada', vencer: 'vencida' },
  aprobada: { cancelar: 'cancelada' },
  rechazada: {},
  cancelada: {},
  vencida: {},
});

export const FICHA_TRANSICIONES = Object.freeze({
  confirmada: {
    registrar_llegada: 'en_espera',
    cancelar: 'cancelada',
    reprogramar: 'reprogramada',
    marcar_ausente: 'ausente',
  },
  en_espera: { llamar: 'llamada', cancelar: 'cancelada', marcar_ausente: 'ausente' },
  llamada: {
    repetir_llamado: 'llamada',
    iniciar_atencion: 'en_atencion',
    marcar_ausente: 'ausente',
    volver_a_espera: 'en_espera',
  },
  en_atencion: { finalizar: 'atendida' },
  ausente: { revertir_ausencia: 'en_espera' },
  atendida: {},
  cancelada: {},
  reprogramada: {},
});

export const ACCIONES_LABEL = Object.freeze({
  aprobar: 'Aprobar y emitir',
  a_lista_espera: 'Pasar a lista de espera',
  rechazar: 'Rechazar',
  cancelar: 'Cancelar',
  vencer: 'Vencer',
  registrar_llegada: 'Registrar llegada',
  reprogramar: 'Reprogramar',
  marcar_ausente: 'Marcar ausente',
  llamar: 'Llamar',
  repetir_llamado: 'Repetir llamado',
  iniciar_atencion: 'Iniciar atención',
  volver_a_espera: 'Volver a sala de espera',
  finalizar: 'Marcar atendido',
  revertir_ausencia: 'Revertir ausencia',
});

const machines = { solicitud: SOLICITUD_TRANSICIONES, ficha: FICHA_TRANSICIONES };

export const canTransition = (machine, from, action) => Boolean(machines[machine]?.[from]?.[action]);

export const availableActions = (machine, from) => Object.keys(machines[machine]?.[from] || {});

/** Devuelve el estado destino o lanza TRANSICION_INVALIDA (RN-SOL-08, RN-FIC-01). */
export function nextState(machine, from, action) {
  const to = machines[machine]?.[from]?.[action];
  if (!to) {
    throw new AppError(
      'TRANSICION_INVALIDA',
      `No se puede "${ACCIONES_LABEL[action] || action}" en estado "${from}".`,
      {
        machine,
        from,
        action,
      },
    );
  }
  return to;
}

export const isTerminal = (machine, estado) => availableActions(machine, estado).length === 0;

/**
 * Estado visible para el ciudadano a partir de solicitud y ficha (BUSINESS_RULES §6.4).
 * @returns {{ key: string, label: string, color: string }}
 */
export function visibleStatus(solicitud, ficha) {
  let key;
  if (!solicitud && ficha) key = ficha.estado === 'llamada' ? 'llamando' : ficha.estado;
  else if (solicitud.estado === 'aprobada' && ficha)
    key = ficha.estado === 'llamada' ? 'llamando' : ficha.estado;
  else key = solicitud.estado;
  return { key, ...(ESTADOS_VISIBLES[key] || { label: key, color: 'default' }) };
}
