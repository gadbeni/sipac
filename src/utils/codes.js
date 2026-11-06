/**
 * Generación de identificadores y códigos públicos.
 */
// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) — RN-SOL-06.
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const defaultRandom = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
};

/** Código de solicitud: {codigoCorto}-{6 caracteres}, p. ej. CSC-7K3F9Q. */
export function generateRequestCode(codigoCorto, random = defaultRandom, existing = null) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let s = '';
    for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
    const code = `${codigoCorto}-${s}`;
    if (!existing || !existing.has(code)) return code;
  }
  throw new Error('No se pudo generar un código único');
}

/** Identificador nuevo con prefijo: 'sol_3f9a2c1b7d4e'. */
export function generateId(prefix) {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${prefix}_${uuid.slice(0, 12)}`;
}

/** Código visible de ficha: prefijo de especialidad + número de 2 dígitos (RN-APR-05). */
export const formatTicketCode = (codigoEspecialidad, numero) =>
  `${codigoEspecialidad}-${String(numero).padStart(2, '0')}`;

/** Clave única de documento de paciente. */
export const documentKey = ({ tipoDocumento, numeroDocumento, complemento }) =>
  `${tipoDocumento}|${String(numeroDocumento).trim().toUpperCase()}|${(complemento || '').trim().toUpperCase()}`;

/** Enmascara un nombre para la consulta pública: "María P***" (RN-PAC-04). */
export const maskName = (nombres, apellidos) => {
  const first = (nombres || '').trim().split(/\s+/)[0] || '';
  const initial = (apellidos || '').trim().charAt(0);
  return initial ? `${first} ${initial}***` : first;
};
