/**
 * Datos del paciente en la solicitud pública (RN-SOL-05). Mensajes en español.
 * El servicio vuelve a validar con el mismo esquema.
 */
import { z } from 'zod';
import { TIPOS_DOCUMENTO } from '@/config/constants';
import { today, ageAt, isValidDate } from '@/utils/dates';

const NAME = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;

export const patientSchema = z
  .object({
    tipoDocumento: z.enum(Object.keys(TIPOS_DOCUMENTO), { error: 'Seleccione el tipo de documento.' }),
    numeroDocumento: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{5,15}$/, 'Entre 5 y 15 letras o números, sin espacios ni guiones.'),
    complemento: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{0,3}$/, 'Hasta 3 letras o números (p. ej. 1A).')
      .transform((v) => v || null)
      .nullable()
      .optional(),
    nombres: z
      .string()
      .trim()
      .min(2, 'Ingrese los nombres.')
      .max(60, 'Máximo 60 caracteres.')
      .regex(NAME, 'Solo letras y espacios.'),
    apellidos: z
      .string()
      .trim()
      .min(2, 'Ingrese los apellidos.')
      .max(60, 'Máximo 60 caracteres.')
      .regex(NAME, 'Solo letras y espacios.'),
    fechaNacimiento: z
      .string()
      .refine((v) => isValidDate(v), 'Ingrese una fecha válida.')
      .refine((v) => !isValidDate(v) || v <= today(), 'La fecha no puede ser futura.')
      .refine((v) => !isValidDate(v) || ageAt(v) <= 120, 'Revise la fecha de nacimiento.'),
    sexo: z.enum(['F', 'M', '']).optional(),
    telefono: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, '').replace(/^\+?591/, ''))
      .pipe(
        z.string().regex(/^[2-7]\d{7}$/, 'Ingrese 8 dígitos: celular (6 o 7…) o fijo con código de área.'),
      ),
    acepta: z.literal(true, { error: 'Debe confirmar para continuar.' }),
  })
  .transform((v) => ({ ...v, sexo: v.sexo || null, telefono: `+591 ${v.telefono}` }));

export const consultSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}-[A-Z0-9]{6}$/, 'Formato: CSC-7K3F9Q.'),
  numeroDocumento: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,15}$/, 'Ingrese el número de documento sin espacios.'),
});
