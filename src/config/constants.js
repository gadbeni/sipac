/**
 * Constantes de dominio. Referencias a reglas en BUSINESS_RULES.md (RN-*).
 */

// ---------------------------------------------------------------- Colecciones
export const COLLECTIONS = Object.freeze({
  centros: 'centros',
  consultorios: 'consultorios',
  especialidades: 'especialidades',
  centroEspecialidades: 'centroEspecialidades',
  medicos: 'medicos',
  medicoCentros: 'medicoCentros',
  horarios: 'horarios',
  excepcionesAgenda: 'excepcionesAgenda',
  pacientes: 'pacientes',
  solicitudes: 'solicitudes',
  fichas: 'fichas',
  usuarios: 'usuarios',
  notificaciones: 'notificaciones',
});

export const ID_PREFIX = Object.freeze({
  centros: 'cen',
  consultorios: 'con',
  especialidades: 'esp',
  centroEspecialidades: 'ce',
  medicos: 'med',
  medicoCentros: 'mc',
  horarios: 'hor',
  excepcionesAgenda: 'exc',
  pacientes: 'pac',
  solicitudes: 'sol',
  fichas: 'fic',
  usuarios: 'usr',
  notificaciones: 'ntf',
});

// ---------------------------------------------------------------- Centros
export const TIPOS_CENTRO = Object.freeze({
  centro_salud: 'Centro de salud',
  centro_salud_integral: 'Centro de salud integral',
  puesto_salud: 'Puesto de salud',
  hospital_basico: 'Hospital básico',
});

export const NIVELES_ATENCION = Object.freeze({
  primer_nivel: 'Primer nivel',
  segundo_nivel: 'Segundo nivel',
  tercer_nivel: 'Tercer nivel',
});

// ---------------------------------------------------------------- Solicitudes
export const ESTADOS_SOLICITUD = Object.freeze({
  pendiente: 'pendiente',
  aprobada: 'aprobada',
  lista_espera: 'lista_espera',
  rechazada: 'rechazada',
  cancelada: 'cancelada',
  vencida: 'vencida',
});

export const SOLICITUD_ACTIVA = Object.freeze([ESTADOS_SOLICITUD.pendiente, ESTADOS_SOLICITUD.lista_espera]);

// ---------------------------------------------------------------- Fichas
export const ESTADOS_FICHA = Object.freeze({
  confirmada: 'confirmada',
  en_espera: 'en_espera',
  llamada: 'llamada',
  en_atencion: 'en_atencion',
  atendida: 'atendida',
  ausente: 'ausente',
  cancelada: 'cancelada',
  reprogramada: 'reprogramada',
});

/** Estados de ficha que ocupan un cupo (DATA_MODEL §5, RN-DIS-02). */
export const FICHA_OCUPA_CUPO = Object.freeze([
  ESTADOS_FICHA.confirmada,
  ESTADOS_FICHA.en_espera,
  ESTADOS_FICHA.llamada,
  ESTADOS_FICHA.en_atencion,
  ESTADOS_FICHA.atendida,
  ESTADOS_FICHA.ausente,
]);

/** Fichas aún pendientes de atención (cuentan como "activas" para el paciente). */
export const FICHA_ACTIVA = Object.freeze([
  ESTADOS_FICHA.confirmada,
  ESTADOS_FICHA.en_espera,
  ESTADOS_FICHA.llamada,
  ESTADOS_FICHA.en_atencion,
]);

export const CANALES = Object.freeze({ web: 'web', ventanilla: 'ventanilla' });
export const PRIORIDADES = Object.freeze({ normal: 'normal', preferente: 'preferente' });

/** Estado visible para el ciudadano (BUSINESS_RULES §6.4). */
export const ESTADOS_VISIBLES = Object.freeze({
  pendiente: { label: 'Pendiente', color: 'warning' },
  lista_espera: { label: 'En lista de espera', color: 'warning' },
  confirmada: { label: 'Confirmada', color: 'success' },
  en_espera: { label: 'En espera', color: 'info' },
  llamando: { label: 'Llamando', color: 'info' },
  en_atencion: { label: 'En atención', color: 'primary' },
  atendida: { label: 'Atendida', color: 'success' },
  ausente: { label: 'No se presentó', color: 'error' },
  reprogramada: { label: 'Reprogramada', color: 'default' },
  cancelada: { label: 'Cancelada', color: 'default' },
  rechazada: { label: 'Rechazada', color: 'error' },
  vencida: { label: 'Vencida', color: 'default' },
});

// ---------------------------------------------------------------- Agenda
export const TIPOS_EXCEPCION = Object.freeze({
  feriado: 'Feriado',
  ausencia: 'Ausencia',
  permiso: 'Permiso',
  bloqueo: 'Bloqueo de agenda',
  ajuste_cupos: 'Ajuste de cupos',
});

export const ALCANCES_EXCEPCION = Object.freeze(['global', 'centro', 'especialidad', 'medico', 'horario']);

export const DIAS_SEMANA = Object.freeze({
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
});

// ---------------------------------------------------------------- Pacientes
export const TIPOS_DOCUMENTO = Object.freeze({
  CI: 'Cédula de identidad',
  CI_EXTRANJERO: 'Cédula de identidad de extranjero',
  PASAPORTE: 'Pasaporte',
  CERTIFICADO_NACIMIENTO: 'Certificado de nacimiento (menores)',
});

// ---------------------------------------------------------------- Motivos
export const MOTIVOS_RECHAZO = Object.freeze([
  'Sin cupos disponibles',
  'Datos del paciente inconsistentes',
  'Especialidad no corresponde',
  'Solicitud duplicada',
  'Otro',
]);

export const MOTIVOS_CANCELACION = Object.freeze([
  'Solicitado por el paciente',
  'Ausencia del profesional',
  'Feriado o bloqueo de agenda',
  'Error de registro',
  'Otro',
]);

// ---------------------------------------------------------------- Límites (configurables)
export const LIMITES = Object.freeze({
  maxSolicitudesActivasPorPaciente: 3, // RN-SOL-03
  cancelacionCiudadanaMinHoras: 2, // RN-SOL-13
  maxReprogramaciones: 2, // RN-FIC-08
  llamadasParaSugerirAusente: 3, // RN-FIC-04
  sesionHoras: 8, // RN-USR-04
  consultaIntentosPorMinuto: 5, // RN-PAC-04
  diasAnticipacionMaxDefault: 14, // RN-DIS-01
  cierreMismoDiaMinDefault: 60, // RN-DIS-01
  factorLimitePendientesDefault: 2, // RN-DIS-03
});

// ---------------------------------------------------------------- Roles y permisos
export const ROLES = Object.freeze({
  admin_central: 'Administrador central',
  admin_centro: 'Administrador de centro',
  recepcionista: 'Recepcionista',
  responsable_medico: 'Responsable médico',
  medico: 'Médico',
});

/** Matriz de permisos (BUSINESS_RULES §9). */
export const PERMISOS_POR_ROL = Object.freeze({
  admin_central: [
    'dashboard.ver',
    'dashboard.global',
    'solicitudes.gestionar',
    'fichas.emitir',
    'fichas.entregar',
    'llamado.controlar',
    'agenda.ver',
    'agenda.gestionar',
    'horarios.gestionar',
    'medicos.gestionar',
    'especialidades.gestionar',
    'especialidades.catalogo',
    'pacientes.ver',
    'pacientes.editar',
    'pacientes.habilitar',
    'reportes.ver',
    'reportes.global',
    'centros.gestionar',
    'usuarios.gestionar',
    'centro.cambiar',
    'demo.restaurar',
  ],
  admin_centro: [
    'dashboard.ver',
    'solicitudes.gestionar',
    'fichas.emitir',
    'fichas.entregar',
    'llamado.controlar',
    'agenda.ver',
    'agenda.gestionar',
    'horarios.gestionar',
    'medicos.gestionar',
    'especialidades.gestionar',
    'pacientes.ver',
    'pacientes.editar',
    'pacientes.habilitar',
    'reportes.ver',
    'usuarios.ver',
    'demo.restaurar',
  ],
  recepcionista: [
    'dashboard.ver',
    'solicitudes.gestionar',
    'fichas.emitir',
    'fichas.entregar',
    'llamado.controlar',
    'agenda.ver',
    'pacientes.ver',
    'pacientes.editar',
    'pacientes.habilitar',
  ],
  responsable_medico: [
    'dashboard.ver',
    'agenda.ver',
    'agenda.gestionar',
    'horarios.gestionar',
    'medicos.gestionar',
    'especialidades.gestionar',
    'pacientes.ver',
    'reportes.ver',
  ],
  medico: [
    'dashboard.ver',
    'agenda.ver',
    'fichas.estadoPropio',
    'llamado.controlar',
    'pacientes.ver',
    'centro.cambiar',
  ],
});

export const hasPermission = (rol, permiso) => Boolean(PERMISOS_POR_ROL[rol]?.includes(permiso));
