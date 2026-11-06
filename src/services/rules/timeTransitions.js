/**
 * Transiciones por paso del tiempo, evaluadas de forma perezosa (ARCHITECTURE R7):
 *  - RN-SOL-09: solicitudes pendiente / lista_espera con fecha pasada → vencida.
 *  - RN-FIC-06: fichas de días pasados: confirmada / en_espera / llamada → ausente (+ bloqueo del paciente),
 *               en_atencion → atendida ("cierre automático").
 * Opera sobre un objeto `tx` de transacción (colecciones solicitudes, fichas, pacientes).
 */
import { blockPatient, isPatientBlocked } from './patientBlock';
import { toIso } from '@/utils/dates';

export const SYSTEM_USER = 'sistema';

/**
 * @param {object} tx transacción con 'solicitudes', 'fichas', 'pacientes'
 * @param {{ today: string, nowIso: string, cutoffDate?: string }} opts  cutoffDate: aplica a fechas < cutoffDate (por defecto hoy)
 */
export function applyTimeTransitions(tx, { today, nowIso, cutoffDate = today }) {
  const stats = { solicitudesVencidas: 0, fichasAusentes: 0, fichasCerradas: 0, pacientesBloqueados: 0 };

  for (const s of tx.all('solicitudes')) {
    if ((s.estado === 'pendiente' || s.estado === 'lista_espera') && s.fechaSolicitada < cutoffDate) {
      tx.update('solicitudes', s.id, {
        estado: 'vencida',
        motivoEstado: 'Fecha de atención vencida sin asignación',
        historial: [
          ...(s.historial || []),
          { estado: 'vencida', fecha: nowIso, usuarioId: SYSTEM_USER, nota: 'Vencimiento automático' },
        ],
      });
      stats.solicitudesVencidas++;
    }
  }

  for (const f of tx.all('fichas')) {
    if (f.fecha >= cutoffDate) continue;
    if (f.estado === 'en_atencion') {
      tx.update('fichas', f.id, {
        estado: 'atendida',
        finAtencionEn: f.finAtencionEn || toIso(f.fecha, '23:59'),
        motivoEstado: 'Cierre automático',
      });
      stats.fichasCerradas++;
    } else if (['confirmada', 'en_espera', 'llamada'].includes(f.estado)) {
      tx.update('fichas', f.id, { estado: 'ausente', motivoEstado: 'Cierre de jornada: no se presentó' });
      stats.fichasAusentes++;
      const p = tx.get('pacientes', f.pacienteId);
      if (p && !isPatientBlocked(p)) {
        tx.update(
          'pacientes',
          p.id,
          blockPatient(p, { fichaId: f.id, centroId: f.centroId, fecha: nowIso, usuarioId: SYSTEM_USER }),
        );
        stats.pacientesBloqueados++;
      }
    }
  }
  return stats;
}
