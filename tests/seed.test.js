import { describe, it, expect } from 'vitest';
import { buildDemoData, seedDemoData, ensureDemoData } from '@/services/seed/initDemoData';
import { validateIntegrity } from '@/services/rules/integrity';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { addDays, toIso, isoWeekday } from '@/utils/dates';

const clockAt = (date, time) => ({ date, time, iso: toIso(date, time) });

// Distintos días de la semana y horas, para que la semilla sea válida "cualquier día".
const CLOCKS = [
  clockAt('2026-11-05', '10:30'), // jueves media mañana
  clockAt('2026-11-07', '08:15'), // sábado
  clockAt('2026-11-08', '19:00'), // domingo de noche
  clockAt('2026-11-09', '06:45'), // lunes antes de abrir
  clockAt('2026-11-17', '15:20'), // víspera de feriado (18/11)
  clockAt('2027-02-03', '12:05'), // fecha lejana: los escenarios no envejecen
];

describe('semilla de demostración', () => {
  for (const clock of CLOCKS) {
    describe(`${clock.date} ${clock.time} (día ${isoWeekday(clock.date)})`, () => {
      const data = buildDemoData(clock);

      it('no tiene errores de integridad', () => {
        expect(validateIntegrity(data)).toEqual([]);
      });

      it('tiene actividad en los últimos 7 días', () => {
        const from = addDays(clock.date, -7);
        expect(data.solicitudes.filter((s) => s.creadoEn.slice(0, 10) >= from).length).toBeGreaterThan(50);
        expect(data.fichas.filter((f) => f.fecha >= from && f.fecha < clock.date).length).toBeGreaterThan(
          100,
        );
      });

      it('tiene solicitudes pendientes y fichas futuras confirmadas', () => {
        expect(
          data.solicitudes.some((s) => s.estado === 'pendiente' && s.fechaSolicitada >= clock.date),
        ).toBe(true);
        expect(data.fichas.some((f) => f.estado === 'confirmada' && f.fecha > clock.date)).toBe(true);
      });

      it('no genera fichas en feriados ni en centros inactivos a futuro', () => {
        const feriados = data.excepcionesAgenda.filter((e) => e.tipo === 'feriado').map((e) => e.fechaInicio);
        expect(data.fichas.some((f) => feriados.includes(f.fecha))).toBe(false);
        expect(data.fichas.some((f) => f.centroId === 'cen_004' && f.fecha >= clock.date)).toBe(false);
      });

      it('los escenarios de demostración existen y el paciente ausente queda bloqueado', () => {
        const sol = data.solicitudes.find((s) => s.codigo === 'CSC-7K3F9Q');
        expect(sol.estado).toBe('aprobada');
        expect(data.fichas.find((f) => f.id === sol.fichaId).estado).toBe('confirmada');
        expect(data.pacientes.find((p) => p.id === 'pac_008').bloqueo.activo).toBe(true);
      });

      it('los pacientes bloqueados no tienen fichas posteriores al bloqueo', () => {
        for (const p of data.pacientes.filter((x) => x.bloqueo.activo)) {
          const desde = data.fichas.find((f) => f.id === p.bloqueo.fichaId).fecha;
          const later = data.fichas.filter(
            (f) => f.pacienteId === p.id && f.fecha > desde && f.estado !== 'cancelada',
          );
          expect(later, p.id).toEqual([]);
        }
      });
    });
  }

  it('es determinista para la misma fecha y hora', () => {
    const a = buildDemoData(CLOCKS[0]);
    const b = buildDemoData(CLOCKS[0]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('cabe holgadamente en LocalStorage (< 1,8 millones de caracteres; Safari admite ~2,5 M)', () => {
    const ds = createLocalDataSource({ storage: createMemoryStorage(), online: () => true, emit: () => {} });
    seedDemoData(ds, CLOCKS[0]);
    expect(ds.usage().chars).toBeLessThan(1_800_000);
  });

  it('ensureDemoData siembra una sola vez y luego aplica transiciones por tiempo', () => {
    const ds = createLocalDataSource({ storage: createMemoryStorage(), online: () => false, emit: () => {} });
    const first = ensureDemoData(ds, CLOCKS[0]);
    expect(first.seeded).toBe(true);
    const hoy = CLOCKS[0].date;
    const pendientesHoy = ds.list('fichas', {
      fecha: hoy,
      estado: ['confirmada', 'en_espera', 'llamada'],
    }).length;
    // Dos días después, lo que quedó abierto se cierra como ausente y las pendientes vencen.
    const later = clockAt(addDays(hoy, 2), '09:00');
    const second = ensureDemoData(ds, later);
    expect(second.seeded).toBe(false);
    expect(second.stats.fichasAusentes).toBeGreaterThanOrEqual(pendientesHoy);
    expect(second.stats.solicitudesVencidas).toBeGreaterThan(0);
    expect(
      ds.list('fichas', {
        fecha: (f) => f < later.date,
        estado: ['confirmada', 'en_espera', 'llamada', 'en_atencion'],
      }),
    ).toEqual([]);
    expect(validateIntegrity(ds.snapshot(Object.keys(first.counts)))).toEqual([]);
  });
});
