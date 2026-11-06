/**
 * Identidad y parámetros configurables del sistema.
 * Para adaptar el sistema a una institución, modificar este archivo o las variables VITE_* (.env).
 * No incluir logotipos ni nombres oficiales sin autorización de la institución.
 */
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const appConfig = {
  appName: env.VITE_APP_NAME || 'SIPAC',
  appFullName: 'Sistema de Gestión de Fichas y Turnos Médicos',
  institution: {
    name: env.VITE_INSTITUTION_NAME || 'Red Departamental de Salud — Demo',
    department: 'Beni',
    country: 'Bolivia',
    phone: '+591 3 0000000',
    email: 'contacto@demo-salud.bo',
    website: null,
  },
  branding: {
    logo: '/branding/logo.svg',
    favicon: '/branding/favicon.svg',
    colors: {
      primary: '#159B72',
      secondary: '#0F766E',
      background: '#F5F7FA',
      text: '#1E293B',
      border: '#E2E8F0',
    },
  },
  locale: {
    language: 'es',
    timezone: 'America/La_Paz',
    // Bolivia no aplica horario de verano: UTC−4 todo el año.
    utcOffset: '-04:00',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  data: {
    source: env.VITE_DATA_SOURCE || 'local',
    apiUrl: env.VITE_API_URL || '',
    storagePrefix: 'sipac',
    schemaVersion: 1,
    fakeLatencyMs: Number(env.VITE_FAKE_LATENCY_MS ?? 200),
  },
  demo: {
    enabled: true,
    notice: 'Prototipo de demostración — datos ficticios. Autenticación simulada, no apto para producción.',
  },
};

export default appConfig;
