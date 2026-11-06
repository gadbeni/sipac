import { isAppError } from '@/services/errors';

/**
 * Ejecuta `fn({ confirmar })`; si el servicio responde ADVERTENCIAS, pide confirmación y reintenta.
 * Devuelve el resultado, o `null` si el usuario desiste.
 */
export async function withWarnings(fn, confirm, title = '¿Continuar de todos modos?') {
  try {
    return await fn({ confirmar: false });
  } catch (e) {
    if (!isAppError(e, 'ADVERTENCIAS')) throw e;
    const ok = await confirm({
      title,
      message: e.details?.warnings?.join(' ') || e.message,
      confirmLabel: 'Continuar',
    });
    return ok ? fn({ confirmar: true }) : null;
  }
}
