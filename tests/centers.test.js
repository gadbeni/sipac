import { describe, expect, it } from 'vitest';
import centros from '@/data/centros.json';
import {
  centerFacets,
  filterCenters,
  formatDays,
  groupWeeklyHours,
  openStatus,
  weeklyHours,
} from '@/services/rules/centers';

const MON = '2026-11-09';
const SAT = '2026-11-14';
const SUN = '2026-11-15';
const central = centros.find((c) => c.codigoCorto === 'CSC');

describe('centros — búsqueda y filtros', () => {
  it('excluye inactivos (San José) por defecto', () => {
    const r = filterCenters(centros);
    expect(r.some((c) => c.codigoCorto === 'CSJ')).toBe(false);
    expect(filterCenters(centros, { soloActivos: false }).some((c) => c.codigoCorto === 'CSJ')).toBe(true);
  });

  it('busca sin tildes por nombre, municipio o código; combina con filtros', () => {
    expect(filterCenters(centros, { q: 'pompeya' }).map((c) => c.codigoCorto)).toEqual(['CSP']);
    expect(filterCenters(centros, { q: 'san javier' }).map((c) => c.codigoCorto)).toEqual(['PSV']);
    expect(filterCenters(centros, { q: 'csc' }).map((c) => c.codigoCorto)).toEqual(['CSC']);
    expect(filterCenters(centros, { municipio: 'Trinidad', tipo: 'puesto_salud' })).toEqual([]);
    expect(filterCenters(centros, { q: 'salud', municipio: 'San Javier' }).map((c) => c.codigoCorto)).toEqual(
      ['PSV'],
    );
  });

  it('ordena por cercanía cuando hay origen y agrega distancia', () => {
    const origin = { lat: -14.5665, lng: -64.6837 }; // San Javier
    const r = filterCenters(centros, { origin });
    expect(r[0].codigoCorto).toBe('PSV');
    expect(r[0].distanciaKm).toBeLessThan(0.01);
    expect(r[1].distanciaKm).toBeGreaterThan(30);
    expect(filterCenters(centros)[0].distanciaKm).toBeNull();
  });

  it('facetas con conteo solo de activos', () => {
    const f = centerFacets(centros);
    expect(f.municipios).toEqual([
      { value: 'San Javier', n: 1 },
      { value: 'Trinidad', n: 3 },
    ]);
    expect(f.tipos.find((t) => t.value === 'puesto_salud').label).toBe('Puesto de salud');
  });
});

describe('centros — horario y apertura', () => {
  it('abierto dentro del horario, cerrado antes/después y en domingo', () => {
    expect(openStatus(central, MON, '10:00').motivo).toBe('ABIERTO');
    expect(openStatus(central, MON, '06:30').motivo).toBe('ANTES_DE_ABRIR');
    expect(openStatus(central, MON, '19:00').motivo).toBe('DESPUES_DE_CERRAR');
    expect(openStatus(central, SAT, '11:59').abierto).toBe(true);
    expect(openStatus(central, SAT, '12:00').abierto).toBe(false);
    expect(openStatus(central, SUN, '10:00').motivo).toBe('CERRADO_HOY');
  });

  it('feriado global o cierre del centro; inactivo', () => {
    const fer = [{ tipo: 'feriado', alcance: 'global', fechaInicio: MON, fechaFin: MON }];
    expect(openStatus(central, MON, '10:00', fer).motivo).toBe('FERIADO');
    const otro = [
      { tipo: 'bloqueo', alcance: 'centro', centroId: 'cen_002', fechaInicio: MON, fechaFin: MON },
    ];
    expect(openStatus(central, MON, '10:00', otro).abierto).toBe(true);
    const parcial = [
      {
        tipo: 'bloqueo',
        alcance: 'centro',
        centroId: central.id,
        fechaInicio: MON,
        fechaFin: MON,
        horaInicio: '10:00',
        horaFin: '12:00',
      },
    ];
    expect(openStatus(central, MON, '10:30', parcial).abierto).toBe(true);
    expect(openStatus({ ...central, activo: false }, MON, '10:00').motivo).toBe('INACTIVO');
  });

  it('formatea días y agrupa el horario semanal', () => {
    expect(formatDays([1, 2, 3, 4, 5])).toBe('Lunes a viernes');
    expect(formatDays([6])).toBe('Sábado');
    expect(formatDays([1, 3, 5])).toBe('Lunes, miércoles y viernes');
    expect(formatDays([6, 7])).toBe('Sábado y domingo');
    const rows = weeklyHours(central).map((r) => ({ ...r, abierto: Boolean(r.apertura) }));
    expect(groupWeeklyHours(rows)).toEqual(central.horarioGeneral);
  });
});
