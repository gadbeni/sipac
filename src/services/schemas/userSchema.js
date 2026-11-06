import { z } from 'zod';
import { ROLES } from '@/config/constants';

const ROLES_CON_CENTRO = ['admin_centro', 'recepcionista', 'responsable_medico'];

/** Usuario del personal (alta/edición por el admin central). */
export const userSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.]{4,30}$/, 'Entre 4 y 30 caracteres: letras minúsculas, números y puntos.'),
    nombre: z.string().trim().min(3, 'Ingrese el nombre.').max(80, 'Máximo 80 caracteres.'),
    email: z.string().trim().email('Correo inválido.'),
    rol: z.enum(Object.keys(ROLES), { error: 'Seleccione el rol.' }),
    centroId: z.string().nullable().optional(),
    medicoId: z.string().nullable().optional(),
    password: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (ROLES_CON_CENTRO.includes(v.rol) && !v.centroId)
      ctx.addIssue({ code: 'custom', path: ['centroId'], message: 'Seleccione el centro.' });
    if (v.rol === 'medico' && !v.medicoId)
      ctx.addIssue({ code: 'custom', path: ['medicoId'], message: 'Seleccione el profesional.' });
  })
  .transform((v) => ({
    ...v,
    centroId: ROLES_CON_CENTRO.includes(v.rol) ? v.centroId : null,
    medicoId: v.rol === 'medico' ? v.medicoId : null,
  }));

export const passwordRule = (p) =>
  typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
