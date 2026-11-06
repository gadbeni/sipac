import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { queueService } from '@/services/queueService';
import { appointmentService } from '@/services/appointmentService';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { callPhrase, spokenCode } from '@/utils/callAlert';
import { setClock, toIso } from '@/utils/dates';

const DATE = '2026-11-09'; // lunes
const ISO = toIso(DATE, '09:00');
const RECEP = {
  usuarioId: 'usr_003',
  rol: 'recepcionista',
  centrosPermitidos: ['cen_001'],
  activeCenterId: 'cen_001',
  centroId: 'cen_001',
};
let ds;

beforeEach(() => {
  setLatency(0);
  setClock(() => new Date(ISO).getTime());
  setOnlineOverride(true);
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: DATE, time: '09:00', iso: ISO });
});
afterAll(() => {
  setClock();
  setOnlineOverride(null);
});

/** Deja un consultorio libre con al menos un paciente en espera y devuelve su id. */
async function readyConsultorio() {
  const hoy = ds.list('fichas').filter((f) => f.centroId === 'cen_001' && f.fecha === DATE);
  const f = hoy.find((x) => x.estado === 'confirmada') || hoy.find((x) => x.estado === 'en_espera');
  if (f.estado === 'confirmada') await appointmentService.checkIn(RECEP, f.id);
  for (const x of ds
    .list('fichas')
    .filter(
      (y) =>
        y.centroId === 'cen_001' &&
        y.fecha === DATE &&
        y.consultorioId === f.consultorioId &&
        ['llamada', 'en_atencion'].includes(y.estado),
    )) {
    if (x.estado === 'llamada') await appointmentService.startAttention(RECEP, x.id);
    await appointmentService.finish(RECEP, x.id);
  }
  return f.consultorioId;
}

describe('pantalla de llamado (RN-PAN-01..03)', () => {
  it('se abre por código corto o institucional, sin sesión', async () => {
    const a = await queueService.getBoard('CSC');
    const b = await queueService.getBoard('ben-tri-0001');
    expect(a.centro.nombre).toBe('Centro de Salud Central');
    expect(b.centro.codigoCorto).toBe('CSC');
    expect(a.fecha).toBe(DATE);
    expect(a.consultorios.length).toBeGreaterThan(0);
    expect(a.consultorios.every((c) => c.consultorio && Array.isArray(c.proximos))).toBe(true);
  });

  it('centro inexistente o inactivo → null', async () => {
    expect(await queueService.getBoard('XXX')).toBeNull();
    await ds.transaction(['centros'], (tx) => tx.update('centros', 'cen_005', { activo: false }));
    expect(await queueService.getBoard('PSV')).toBeNull();
  });

  it('nunca expone nombres ni documentos de pacientes (CA)', async () => {
    await appointmentService.callNext(RECEP, await readyConsultorio());
    const json = JSON.stringify(await queueService.getBoard('CSC'));
    const ids = new Set(
      ds
        .list('fichas')
        .filter((f) => f.centroId === 'cen_001')
        .map((f) => f.pacienteId),
    );
    for (const p of ds.list('pacientes').filter((x) => ids.has(x.id))) {
      expect(json).not.toContain(p.numeroDocumento);
      expect(json).not.toContain(`${p.nombres} ${p.apellidos}`);
      expect(json).not.toContain(p.apellidos);
    }
    expect(json).not.toMatch(/paciente"|documento|telefono|pacienteId/);
  });

  it('“Llamar siguiente” aparece como llamado actual; repetir cambia el evento', async () => {
    const consultorioId = await readyConsultorio();
    const called = await appointmentService.callNext(RECEP, consultorioId);
    let board = await queueService.getBoard('CSC');
    expect(board.ultimoLlamado).toMatchObject({ codigoVisible: called.codigoVisible, estado: 'llamada' });
    const c = board.consultorios.find((x) => x.consultorioId === consultorioId);
    expect(c.actual.codigoVisible).toBe(called.codigoVisible);
    expect(c.proximos.some((p) => p.id === called.id)).toBe(false);
    const ev1 = board.eventoLlamado;

    setClock(() => new Date(ISO).getTime() + 60_000);
    await appointmentService.repeatCall(RECEP, called.id);
    board = await queueService.getBoard('CSC');
    expect(board.eventoLlamado).not.toBe(ev1);
    expect(board.ultimoLlamado.llamadas).toBe(2);

    await appointmentService.startAttention(RECEP, called.id);
    board = await queueService.getBoard('CSC');
    // Pasa a otro llamado vigente (si lo hay) y la ficha queda en "Últimos llamados".
    expect(board.ultimoLlamado?.id).not.toBe(called.id);
    if (board.ultimoLlamado) expect(board.ultimoLlamado.estado).toBe('llamada');
    expect(board.consultorios.find((x) => x.consultorioId === consultorioId).actual.estado).toBe(
      'en_atencion',
    );
    expect(board.ultimos[0].codigoVisible).toBe(called.codigoVisible);
    expect(board.ultimos.some((t) => t.id === board.ultimoLlamado?.id)).toBe(false);
    expect(board.ultimos.length).toBeLessThanOrEqual(5);
  });

  it('próximos respetan el orden de la sala (preferente primero)', async () => {
    const board = await queueService.getBoard('CSC');
    const q = await appointmentService.getQueue(RECEP);
    for (const c of board.consultorios) {
      const espera = q.find((x) => x.consultorioId === c.consultorioId)?.espera || [];
      expect(c.proximos.map((p) => p.id)).toEqual(espera.slice(0, 3).map((f) => f.id));
      expect(c.enEspera).toBe(espera.length);
    }
  });
});

describe('frase del llamado por voz', () => {
  it('lee las letras y el número sin ceros', () => {
    expect(spokenCode('MG-005')).toBe('M G 5');
    expect(callPhrase('PED-012', 'Consultorio 2')).toBe('Ficha P E D 12. Diríjase a Consultorio 2.');
  });
});
