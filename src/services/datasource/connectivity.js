/**
 * Estado de conectividad. Fuente única usada por la capa de datos para bloquear escrituras
 * sin conexión (RN-OFF-01), aunque el prototipo sea local.
 */
let override = null;

export const isOnline = () => {
  if (override !== null) return override;
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) return navigator.onLine;
  return true;
};

/** Fuerza el estado (pruebas o simulación). null = usar navigator.onLine. */
export const setOnlineOverride = (value) => {
  override = value;
};
