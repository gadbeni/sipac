import { describe, it, expect } from 'vitest';
import {
  nextState,
  canTransition,
  availableActions,
  visibleStatus,
  isTerminal,
} from '@/services/rules/stateMachines';
import { blockPatient, unblockPatient, canUnblock, isPatientBlocked } from '@/services/rules/patientBlock';
import { applyTimeTransitions } from '@/services/rules/timeTransitions';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { AppError } from '@/services/errors';

describe('máquina de estados de solicitud (RN-SOL-08)', () => {
  it('transiciones válidas', () => {
    expect(nextState('solicitud', 'pendiente', 'aprobar')).toBe('aprobada');
    expect(nextState('solicitud', 'pendiente', 'a_lista_espera')).toBe('lista_espera');
    expect(nextState('solicitud', 'lista_espera', 'aprobar')).toBe('aprobada');
    expect(nextState('solicitud', 'aprobada', 'cancelar')).toBe('cancelada');
  });

  it('transiciones inválidas lanzan TRANSICION_INVALIDA', () => {
    expect(() => nextState('solicitud', 'rechazada', 'aprobar')).toThrow(AppError);
    expect(() => nextState('solicitud', 'aprobada', 'rechazar')).toThrowError(/No se puede/);
    expect(canTransition('solicitud', 'vencida', 'cancelar')).toBe(false);
  });

  it('estados terminales', () => {
    for (const e of ['rechazada', 'cancelada', 'vencida']) expect(isTerminal('solicitud', e)).toBe(true);
    expect(isTerminal('solicitud', 'pendiente')).toBe(false);
  });
});

describe('máquina de estados de ficha (RN-FIC-01)', () => {
  it('flujo completo de atención', () => {
    let e = 'confirmada';
    for (const a of ['registrar_llegada', 'llamar', 'repetir_llamado', 'iniciar_atencion', 'finalizar'])
      e = nextState('ficha', e, a);
    expect(e).toBe('atendida');
  });

  it('no se cancelan fichas atendidas ni ausentes (RN-FIC-07)', () => {
    expect(canTransition('ficha', 'atendida', 'cancelar')).toBe(false);
    expect(canTransition('ficha', 'ausente', 'cancelar')).toBe(false);
  });

  it('la ausencia se puede revertir a sala de espera (RN-FIC-05)', () => {
    expect(nextState('ficha', 'ausente', 'revertir_ausencia')).toBe('en_espera');
  });

  it('solo se reprograma una ficha confirmada', () => {
    expect(availableActions('ficha', 'confirmada')).toContain('reprogramar');
    expect(canTransition('ficha', 'en_espera', 'reprogramar')).toBe(false);
  });
});

describe('estado visible para el ciudadano (§6.4)', () => {
  it('combina solicitud y ficha', () => {
    expect(visibleStatus({ estado: 'pendiente' }, null).label).toBe('Pendiente');
    expect(visibleStatus({ estado: 'lista_espera' }, null).label).toBe('En lista de espera');
    expect(visibleStatus({ estado: 'aprobada' }, { estado: 'confirmada' }).label).toBe('Confirmada');
    expect(visibleStatus({ estado: 'aprobada' }, { estado: 'llamada' }).label).toBe('Llamando');
    expect(visibleStatus({ estado: 'aprobada' }, { estado: 'ausente' }).label).toBe('No se presentó');
    expect(visibleStatus({ estado: 'cancelada' }, { estado: 'cancelada' }).label).toBe('Cancelada');
    expect(visibleStatus(null, { estado: 'en_atencion' }).label).toBe('En atención');
  });
});

describe('bloqueo por inasistencia (D-22)', () => {
  const p = { id: 'p1', bloqueo: { activo: false }, historialBloqueos: [] };

  it('bloquea y habilita dejando historial', () => {
    const b = blockPatient(p, { fichaId: 'f1', centroId: 'c1', fecha: 'x', usuarioId: 'sistema' });
    expect(isPatientBlocked(b)).toBe(true);
    const u = unblockPatient(b, { fecha: 'y', usuarioId: 'u1', nota: 'Justificó' });
    expect(isPatientBlocked(u)).toBe(false);
    expect(u.historialBloqueos.map((h) => h.accion)).toEqual(['bloqueo', 'habilitacion']);
    expect(u.historialBloqueos[1]).toMatchObject({ fichaId: 'f1', centroId: 'c1', nota: 'Justificó' });
  });

  it('solo puede habilitar el admin central o personal del centro de la inasistencia (RN-PAC-07)', () => {
    const b = blockPatient(p, { fichaId: 'f1', centroId: 'c1', fecha: 'x', usuarioId: 'sistema' });
    expect(canUnblock({ rol: 'admin_central', centroId: null }, b)).toBe(true);
    expect(canUnblock({ rol: 'recepcionista', centroId: 'c1' }, b)).toBe(true);
    expect(canUnblock({ rol: 'recepcionista', centroId: 'c2' }, b)).toBe(false);
    expect(canUnblock({ rol: 'responsable_medico', centroId: 'c1' }, b)).toBe(false);
  });
});

describe('transiciones por tiempo (RN-SOL-09, RN-FIC-06)', () => {
  it('vence solicitudes, cierra jornadas pasadas y bloquea ausentes', () => {
    const ds = createLocalDataSource({ storage: createMemoryStorage(), online: () => true, emit: () => {} });
    ds.replaceAll({
      solicitudes: [
        { id: 's1', estado: 'pendiente', fechaSolicitada: '2026-11-04', historial: [] },
        { id: 's2', estado: 'pendiente', fechaSolicitada: '2026-11-05', historial: [] },
      ],
      fichas: [
        { id: 'f1', estado: 'confirmada', fecha: '2026-11-04', pacienteId: 'p1', centroId: 'c1' },
        { id: 'f2', estado: 'en_atencion', fecha: '2026-11-04', pacienteId: 'p2', centroId: 'c1' },
        { id: 'f3', estado: 'confirmada', fecha: '2026-11-05', pacienteId: 'p3', centroId: 'c1' },
      ],
      pacientes: ['p1', 'p2', 'p3'].map((id) => ({ id, bloqueo: { activo: false }, historialBloqueos: [] })),
    });
    const stats = ds.transaction(['solicitudes', 'fichas', 'pacientes'], (tx) =>
      applyTimeTransitions(tx, { today: '2026-11-05', nowIso: '2026-11-05T07:00:00-04:00' }),
    );
    expect(stats).toEqual({
      solicitudesVencidas: 1,
      fichasAusentes: 1,
      fichasCerradas: 1,
      pacientesBloqueados: 1,
    });
    expect(ds.get('fichas', 'f1').estado).toBe('ausente');
    expect(ds.get('fichas', 'f2').estado).toBe('atendida');
    expect(ds.get('fichas', 'f3').estado).toBe('confirmada');
    expect(ds.get('pacientes', 'p1').bloqueo.activo).toBe(true);
    expect(ds.get('solicitudes', 's2').estado).toBe('pendiente');
  });
});
