/**
 * Fuente única de rutas: path, título, permiso requerido, épica que la implementa y entrada del sidebar.
 * El router, los guards y el menú lateral se generan a partir de esta lista.
 * `permission`: un permiso o una lista (basta con uno); sin `permission` = cualquier usuario autenticado.
 */
export const PUBLIC_ROUTES = [
  { path: '/', title: 'Inicio', epic: 4, menu: true },
  { path: '/centros', title: 'Centros de salud', navLabel: 'Centros', epic: 3, menu: true },
  { path: '/centros/:codigo', title: 'Detalle del centro', epic: 3 },
  { path: '/especialidades', title: 'Especialidades', epic: 4, menu: true, requiresCenter: true },
  { path: '/medicos-de-turno', title: 'Médicos de turno', epic: 4, menu: true, requiresCenter: true },
  {
    path: '/horarios',
    title: 'Horarios de atención',
    navLabel: 'Horarios',
    epic: 4,
    menu: true,
    requiresCenter: true,
  },
  { path: '/solicitar-ficha', title: 'Solicitar ficha', epic: 5, cta: true },
  { path: '/consultar', title: 'Consultar solicitud', navLabel: 'Consultar', epic: 5, menu: true },
  { path: '/login', title: 'Ingreso al sistema', epic: 6 },
];

export const DISPLAY_ROUTES = [{ path: '/pantalla/:codigoCentro', title: 'Pantalla de llamado', epic: 11 }];

export const ADMIN_ROUTES = [
  {
    path: '/admin',
    title: 'Dashboard',
    epic: 7,
    permission: 'dashboard.ver',
    sidebar: { order: 1, icon: 'Dashboard', group: 'operacion' },
  },
  {
    path: '/admin/solicitudes',
    title: 'Solicitudes de fichas',
    epic: 8,
    permission: 'solicitudes.gestionar',
    sidebar: { order: 2, icon: 'Assignment', group: 'operacion' },
  },
  {
    path: '/admin/entrega',
    title: 'Entrega de fichas',
    epic: 8,
    permission: 'fichas.entregar',
    sidebar: { order: 3, icon: 'ConfirmationNumber', group: 'operacion' },
  },
  {
    path: '/admin/agenda',
    title: 'Agenda médica',
    epic: 9,
    permission: 'agenda.ver',
    sidebar: { order: 4, icon: 'CalendarMonth', group: 'operacion' },
  },
  {
    path: '/admin/medicos',
    title: 'Médicos',
    epic: 9,
    permission: 'medicos.gestionar',
    sidebar: { order: 5, icon: 'MedicalServices', group: 'gestion' },
  },
  { path: '/admin/medicos/:id', title: 'Detalle del médico', epic: 9, permission: 'medicos.gestionar' },
  {
    path: '/admin/especialidades',
    title: 'Especialidades',
    epic: 9,
    permission: 'especialidades.gestionar',
    sidebar: { order: 6, icon: 'Category', group: 'gestion' },
  },
  {
    path: '/admin/horarios',
    title: 'Horarios',
    epic: 9,
    permission: 'horarios.gestionar',
    sidebar: { order: 7, icon: 'Schedule', group: 'gestion' },
  },
  {
    path: '/admin/pacientes',
    title: 'Pacientes',
    epic: 10,
    permission: 'pacientes.ver',
    sidebar: { order: 8, icon: 'People', group: 'gestion' },
  },
  { path: '/admin/pacientes/:id', title: 'Detalle del paciente', epic: 10, permission: 'pacientes.ver' },
  {
    path: '/admin/centros',
    title: 'Centros de salud',
    epic: 3,
    permission: 'centros.gestionar',
    sidebar: { order: 9, icon: 'LocalHospital', group: 'administracion' },
  },
  {
    path: '/admin/usuarios',
    title: 'Usuarios',
    epic: 6,
    permission: ['usuarios.gestionar', 'usuarios.ver'],
    sidebar: { order: 10, icon: 'ManageAccounts', group: 'administracion' },
  },
  {
    path: '/admin/reportes',
    title: 'Reportes',
    epic: 12,
    permission: 'reportes.ver',
    sidebar: { order: 11, icon: 'Assessment', group: 'administracion' },
  },
  {
    path: '/admin/configuracion',
    title: 'Configuración',
    epic: 2,
    sidebar: { order: 12, icon: 'Settings', group: 'administracion' },
  },
  { path: '/admin/perfil', title: 'Mi perfil', epic: 6 },
];

/** Grupos del menú lateral, en orden. */
export const SIDEBAR_GROUPS = [
  { id: 'operacion', label: 'Operación' },
  { id: 'gestion', label: 'Gestión' },
  { id: 'administracion', label: 'Administración' },
];

export const ALL_ROUTES = [...PUBLIC_ROUTES, ...DISPLAY_ROUTES, ...ADMIN_ROUTES];
