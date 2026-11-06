/**
 * Validación de centros (formulario del panel y servicio). Mensajes en español.
 * El servicio vuelve a validar: la UI no es la única barrera (equivalente al FormRequest de Laravel).
 */
import { z } from 'zod';
import { TIPOS_CENTRO, NIVELES_ATENCION } from '@/config/constants';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dayHoursSchema = z
  .object({
    dia: z.number().int().min(1).max(7),
    abierto: z.boolean(),
    apertura: z.string(),
    cierre: z.string(),
  })
  .superRefine((d, ctx) => {
    if (!d.abierto) return;
    if (!HHMM.test(d.apertura))
      ctx.addIssue({ code: 'custom', path: ['apertura'], message: 'Hora inválida.' });
    if (!HHMM.test(d.cierre)) ctx.addIssue({ code: 'custom', path: ['cierre'], message: 'Hora inválida.' });
    if (HHMM.test(d.apertura) && HHMM.test(d.cierre) && d.cierre <= d.apertura)
      ctx.addIssue({ code: 'custom', path: ['cierre'], message: 'Debe ser posterior a la apertura.' });
  });

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => v || null)
    .nullable()
    .optional();

export const centerSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}-[A-Z]{3}-\d{4}$/, 'Formato: BEN-TRI-0001.'),
  codigoCorto: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Tres letras, por ejemplo CSC.'),
  nombre: z.string().trim().min(5, 'Ingrese al menos 5 caracteres.').max(120, 'Máximo 120 caracteres.'),
  tipo: z.enum(Object.keys(TIPOS_CENTRO), { error: 'Seleccione el tipo.' }),
  nivelAtencion: z.enum(Object.keys(NIVELES_ATENCION), { error: 'Seleccione el nivel.' }),
  descripcion: optionalText(400),
  direccion: z.string().trim().min(5, 'Ingrese la dirección.').max(200, 'Máximo 200 caracteres.'),
  provincia: z.string().trim().min(2, 'Ingrese la provincia.'),
  municipio: z.string().trim().min(2, 'Ingrese el municipio.'),
  localidad: z.string().trim().min(2, 'Ingrese la localidad.'),
  latitud: z.coerce
    .number({ error: 'Ingrese un número.' })
    .min(-23, 'Fuera de Bolivia.')
    .max(-9.6, 'Fuera de Bolivia.'),
  longitud: z.coerce
    .number({ error: 'Ingrese un número.' })
    .min(-69.7, 'Fuera de Bolivia.')
    .max(-57.4, 'Fuera de Bolivia.'),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{7,20}$/, 'Teléfono inválido.'),
  email: z
    .string()
    .trim()
    .email('Correo inválido.')
    .or(z.literal('').transform(() => null))
    .nullable()
    .optional(),
  horario: z
    .array(dayHoursSchema)
    .length(7)
    .refine((rows) => rows.some((r) => r.abierto), 'Indique al menos un día de atención.'),
  diasAnticipacionMax: z.coerce
    .number()
    .int('Número entero.')
    .min(1, 'Mínimo 1 día.')
    .max(60, 'Máximo 60 días.'),
  cierreMismoDiaMin: z.coerce
    .number()
    .int('Número entero.')
    .min(0, 'Mínimo 0.')
    .max(600, 'Máximo 600 minutos.'),
});
