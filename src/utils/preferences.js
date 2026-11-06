/**
 * Preferencias del usuario en LocalStorage (`sipac:pref:*`). No se borran al restaurar
 * los datos de demostración. Toda lectura/escritura tolera navegadores sin almacenamiento.
 */
import { appConfig } from '@/config/app.config';

const key = (name) => `${appConfig.data.storagePrefix}:pref:${name}`;

export function readPref(name, fallback) {
  try {
    const raw = localStorage.getItem(key(name));
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePref(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* modo privado o almacenamiento lleno: la preferencia dura la sesión */
  }
}

export const prefKey = key;
