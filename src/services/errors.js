/**
 * Error de dominio con código estable. La UI traduce `code` a mensajes (Snackbar/Alert).
 */
export class AppError extends Error {
  constructor(code, message, details = undefined) {
    super(message || ERROR_MESSAGES[code] || code);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export const ERROR_MESSAGES = Object.freeze({
  SIN_CONEXION: 'No hay conexión. La operación no se realizó.',
  ACCESO_DENEGADO: 'No tiene acceso a esta información.',
  PERMISO_DENEGADO: 'No tiene permiso para realizar esta acción.',
  NO_ENCONTRADO: 'El registro solicitado no existe.',
  VALIDACION: 'Los datos ingresados no son válidos.',
  TRANSICION_INVALIDA: 'La acción no está permitida en el estado actual.',
  CUPO_AGOTADO: 'No quedan cupos disponibles para el horario seleccionado.',
  SOLICITUD_DUPLICADA: 'Ya existe una solicitud activa para el mismo centro, especialidad y fecha.',
  LIMITE_SOLICITUDES: 'Alcanzó el máximo de solicitudes activas permitidas.',
  PACIENTE_BLOQUEADO:
    'Su documento tiene una inasistencia registrada. Acérquese al centro de salud para habilitarlo.',
  CENTRO_INACTIVO: 'El centro de salud no está disponible actualmente.',
  FECHA_NO_DISPONIBLE: 'La fecha seleccionada no tiene disponibilidad.',
  DEMANDA_ALTA: 'Demanda alta para esta fecha. Intente con otra fecha.',
  CONFLICTO_DATOS: 'Los datos cambiaron mientras realizaba la operación. Vuelva a intentarlo.',
  DUPLICADO: 'Ya existe un registro con esos datos.',
  MEDICO_NO_DISPONIBLE: 'El profesional elegido ya no tiene fichas disponibles para esa fecha.',
  SOLICITUD_NO_ENCONTRADA: 'No se encontró una solicitud con esos datos.',
  DEMASIADOS_INTENTOS: 'Demasiados intentos. Espere un minuto e intente nuevamente.',
  CANCELACION_NO_PERMITIDA:
    'Esta solicitud ya no se puede cancelar desde el portal. Comuníquese con el centro de salud.',
  CREDENCIALES_INVALIDAS: 'Usuario o contraseña incorrectos.',
  USUARIO_INACTIVO: 'Su usuario está desactivado. Comuníquese con la administración.',
  USUARIO_SIN_CENTRO: 'Su usuario no tiene un centro de salud asignado.',
  SESION_EXPIRADA: 'Su sesión expiró. Vuelva a ingresar.',
  NO_IMPLEMENTADO: 'Funcionalidad no disponible en este modo.',
  ALMACENAMIENTO_LLENO: 'El almacenamiento del navegador está lleno. Restaure los datos de demostración.',
});

export const isAppError = (e, code) => e instanceof AppError && (!code || e.code === code);
