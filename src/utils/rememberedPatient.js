/**
 * Datos del paciente recordados en este dispositivo (`sipac:pref:pacienteRecordado`) para
 * precargar la próxima solicitud del portal. Solo se guarda si el ciudadano lo acepta y la
 * solicitud se registró. Únicamente datos de identificación y contacto: nunca información
 * clínica ni la declaración de conformidad (que debe aceptarse en cada solicitud).
 */
import { prefKey, readPref, writePref } from './preferences';

const NAME = 'pacienteRecordado';
export const REMEMBERED_FIELDS = [
  'tipoDocumento',
  'numeroDocumento',
  'complemento',
  'nombres',
  'apellidos',
  'fechaNacimiento',
  'sexo',
  'telefono',
];

const pick = (values) =>
  Object.fromEntries(REMEMBERED_FIELDS.map((f) => [f, typeof values?.[f] === 'string' ? values[f] : '']));

/** Devuelve los datos guardados o `null` si no hay (o están corruptos). */
export function readRememberedPatient() {
  const saved = readPref(NAME, null);
  if (!saved || typeof saved !== 'object' || !saved.numeroDocumento) return null;
  return pick(saved);
}

export function saveRememberedPatient(values) {
  writePref(NAME, pick(values));
}

export function forgetRememberedPatient() {
  try {
    localStorage.removeItem(prefKey(NAME));
  } catch {
    /* sin almacenamiento */
  }
}
