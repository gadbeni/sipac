import { describe, expect, it } from 'vitest';
import { buildDemoData } from '@/services/seed/initDemoData';
import {
  computeKpis,
  demandBySpecialty,
  distributionByHour,
  issuedVsAttended,
  requestsByDay,
} from '@/services/rules/kpis';
import { computeInsights } from '@/services/rules/insights';
import { addDays, isoToDate, toIso } from '@/utils/dates';

const TODAY = '2026-11-09';
const now = { date: TODAY, time: '10:30' };
const data = buildDemoData({ ...now, iso: toIso(TODAY, now.time) });
const C = 'cen_001';

// Recuentos "a mano", escritos de forma independiente a kpis.js.
const manual = (centroId) => {
  const f = data.fichas.filter((x) => !centroId || x.centroId === centroId);
  const s = data.solicitudes.filter((x) => !centroId || x.centroId === centroId);
  const hoy = f.filter((x) => x.fecha === TODAY);
  const semana = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(TODAY, -i));
  const cerr = f.filter((x) => semana.includes(x.fecha) && ['atendida', 'ausente'].includes(x.estado));
  return {
    fichasHoy: hoy.filter((x) => x.estado !== 'cancelada' && x.estado !== 'reprogramada').length,
    solicitudesPendientes: s.filter((x) => x.estado === 'pendiente' && x.fechaSolicitada >= TODAY).length,
    enEspera: hoy.filter((x) => x.estado === 'en_espera' || x.estado === 'llamada').length,
    atendidos: hoy.filter((x) => x.estado === 'atendida').length,
    ausentismo: cerr.length
      ? Math.round((cerr.filter((x) => x.estado === 'ausente').length / cerr.length) * 1000) / 10
      : null,
  };
};

describe('KPIs (dataset fijo, lunes 09/11/2026 10:30)', () => {
  for (const centroId of [C, 'cen_002', null]) {
    it(`coinciden con el recuento manual — ${centroId || 'todos los centros'}`, () => {
      const k = computeKpis(data, { centroId }, { today: TODAY });
      const m = manual(centroId);
      expect(k.fichasHoy).toBe(m.fichasHoy);
      expect(k.solicitudesPendientes).toBe(m.solicitudesPendientes);
      expect(k.enEspera).toBe(m.enEspera);
      expect(k.atendidos).toBe(m.atendidos);
      expect(k.ausentismoPct).toBe(m.ausentismo);
      expect(k.fichasHoy).toBeGreaterThan(0);
      expect(k.ocupacionPct).toBeGreaterThan(0);
      expect(k.ocupacionPct).toBeLessThanOrEqual(100);
      expect(k.fichasDisponibles).toBe(k.cuposEfectivosHoy - k.ocupadosHoy);
    });
  }

  it('"todos los centros" = suma de los centros', () => {
    const all = computeKpis(data, { centroId: null }, { today: TODAY });
    const sum = ['cen_001', 'cen_002', 'cen_003', 'cen_004', 'cen_005'].reduce(
      (a, c) => a + computeKpis(data, { centroId: c }, { today: TODAY }).fichasHoy,
      0,
    );
    expect(all.fichasHoy).toBe(sum);
  });

  it('vista de médico: solo sus fichas', () => {
    const k = computeKpis(data, { centroId: C, medicoId: 'med_001' }, { today: TODAY });
    expect(k.fichasHoy).toBe(
      data.fichas.filter(
        (f) =>
          f.centroId === C &&
          f.medicoId === 'med_001' &&
          f.fecha === TODAY &&
          !['cancelada', 'reprogramada'].includes(f.estado),
      ).length,
    );
    expect(k.solicitudesPendientes).toBe(0);
  });
});

describe('series de gráficos', () => {
  it('solicitudes por día (7 días) suman lo creado en la ventana', () => {
    const rows = requestsByDay(data, { centroId: C }, { today: TODAY });
    expect(rows).toHaveLength(7);
    expect(rows.at(-1).fecha).toBe(TODAY);
    const desde = addDays(TODAY, -6);
    const esperado = data.solicitudes.filter(
      (s) => s.centroId === C && isoToDate(s.creadoEn) >= desde && isoToDate(s.creadoEn) <= TODAY,
    ).length;
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(esperado);
  });

  it('emitidas ≥ atendidas cada día; distribución por franja suma las fichas de hoy', () => {
    for (const r of issuedVsAttended(data, { centroId: C }, { today: TODAY }))
      expect(r.emitidas).toBeGreaterThanOrEqual(r.atendidas);
    const dist = distributionByHour(data, { centroId: C }, { fecha: TODAY });
    expect(dist.reduce((a, r) => a + r.fichas, 0)).toBe(
      computeKpis(data, { centroId: C }, { today: TODAY }).fichasHoy,
    );
  });

  it('demanda por especialidad ordenada de mayor a menor', () => {
    const d = demandBySpecialty(data, { centroId: C }, { today: TODAY });
    expect(d.length).toBeGreaterThan(2);
    for (let i = 1; i < d.length; i++) expect(d[i - 1].total).toBeGreaterThanOrEqual(d[i].total);
  });
});

describe('insights', () => {
  it('solo aparecen los que aplican y cambian con el centro', () => {
    const forCenter = (centroId) =>
      computeInsights(
        data,
        { centroId },
        { today: TODAY, now, kpis: computeKpis(data, { centroId }, { today: TODAY }) },
      );
    const a = forCenter(C);
    const b = forCenter('cen_005');
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((i) => i.id)).not.toEqual(b.map((i) => i.id));
    // "pendientes" aparece si y solo si hay pendientes para hoy/mañana.
    for (const c of [C, 'cen_002', 'cen_003', 'cen_005']) {
      const k = computeKpis(data, { centroId: c }, { today: TODAY });
      expect(forCenter(c).some((i) => i.id === 'pendientes')).toBe(k.pendientesHoyManana > 0);
    }
  });

  it('ausentismo alto aparece cuando supera el 15 %', () => {
    const forzado = {
      ...data,
      fichas: data.fichas.map((f) =>
        f.centroId === C && f.estado === 'atendida' && f.fecha < TODAY ? { ...f, estado: 'ausente' } : f,
      ),
    };
    const k = computeKpis(forzado, { centroId: C }, { today: TODAY });
    expect(k.ausentismoPct).toBeGreaterThan(15);
    expect(
      computeInsights(forzado, { centroId: C }, { today: TODAY, now, kpis: k }).some(
        (i) => i.id === 'ausentismo',
      ),
    ).toBe(true);
  });

  it('ordenados por severidad', () => {
    const order = { error: 0, warning: 1, success: 2, info: 3 };
    const list = computeInsights(
      data,
      { centroId: C },
      { today: TODAY, now, kpis: computeKpis(data, { centroId: C }, { today: TODAY }) },
    );
    for (let i = 1; i < list.length; i++)
      expect(order[list[i - 1].severity]).toBeLessThanOrEqual(order[list[i].severity]);
  });
});

describe('notificaciones visibles por sesión', async () => {
  const { isVisibleTo } = await import('@/services/notificationService');
  const n = { centroId: 'cen_001', destinoUsuarioId: null, destinoRoles: ['admin_centro', 'recepcionista'] };
  it('rol y centro', () => {
    expect(
      isVisibleTo(n, {
        usuarioId: 'u',
        rol: 'recepcionista',
        centrosPermitidos: ['cen_001'],
        activeCenterId: 'cen_001',
      }),
    ).toBe(true);
    expect(
      isVisibleTo(n, {
        usuarioId: 'u',
        rol: 'recepcionista',
        centrosPermitidos: ['cen_002'],
        activeCenterId: 'cen_002',
      }),
    ).toBe(false);
    expect(
      isVisibleTo(n, {
        usuarioId: 'u',
        rol: 'medico',
        centrosPermitidos: ['cen_001'],
        activeCenterId: 'cen_001',
      }),
    ).toBe(false);
    expect(
      isVisibleTo(n, { usuarioId: 'u', rol: 'admin_central', centrosPermitidos: [], activeCenterId: null }),
    ).toBe(true);
    expect(
      isVisibleTo(n, {
        usuarioId: 'u',
        rol: 'admin_central',
        centrosPermitidos: [],
        activeCenterId: 'cen_002',
      }),
    ).toBe(false);
  });
});
