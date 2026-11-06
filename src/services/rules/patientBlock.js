/**
 * Bloqueo de pacientes por inasistencia (D-22, RN-PAC-05 a RN-PAC-09).
 */
export const emptyBlock = () => ({ activo: false, motivo: null, fichaId: null, centroId: null, desde: null });

export const isPatientBlocked = (paciente) => Boolean(paciente?.bloqueo?.activo);

/** Devuelve el paciente bloqueado por la ficha ausente indicada. */
export function blockPatient(paciente, { fichaId, centroId, fecha, usuarioId, nota = null }) {
  return {
    ...paciente,
    bloqueo: { activo: true, motivo: 'Inasistencia a ficha', fichaId, centroId, desde: fecha },
    historialBloqueos: [
      ...(paciente.historialBloqueos || []),
      { accion: 'bloqueo', fecha, usuarioId, fichaId, centroId, nota },
    ],
  };
}

/** Levanta el bloqueo (habilitación manual o reversión de la ausencia). */
export function unblockPatient(paciente, { fecha, usuarioId, nota }) {
  const b = paciente.bloqueo || emptyBlock();
  return {
    ...paciente,
    bloqueo: emptyBlock(),
    historialBloqueos: [
      ...(paciente.historialBloqueos || []),
      { accion: 'habilitacion', fecha, usuarioId, fichaId: b.fichaId, centroId: b.centroId, nota },
    ],
  };
}

/**
 * ¿Puede el usuario levantar el bloqueo? (RN-PAC-07)
 * admin_central siempre; admin_centro / recepcionista solo del centro donde ocurrió la inasistencia.
 */
export function canUnblock(usuario, paciente) {
  if (!isPatientBlocked(paciente)) return false;
  if (usuario.rol === 'admin_central') return true;
  return (
    ['admin_centro', 'recepcionista'].includes(usuario.rol) && usuario.centroId === paciente.bloqueo.centroId
  );
}
