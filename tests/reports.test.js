import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { reportService } from '@/services/reportService';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { csvCell, toCsv } from '@/utils/csv';
import { reportCsv } from '@/pages/admin/reportes/reportColumns';
import { addDays, setClock, toIso } from '@/utils/dates';

const DATE = '2026-11-09';
const ISO = toIso(DATE, '11:00');
const S = (o) => ({ centrosPermitidos: [o.centro], activeCenterId: o.centro, centroId: o.centro, ...o });
const CENTRAL = {
  usuarioId: 'usr_001',
  rol: 'admin_central',
  centrosPermitidos: [],
  activeCenterId: null,
  nombre: 'Admin',
};
const ADMIN_CSP = S({ usuarioId: 'usr_006', rol: 'admin_centro', centro: 'cen_002' });
const RESP_CSC = S({ usuarioId: 'usr_004', rol: 'responsable_medico', centro: 'cen_001' });
const RECEP = S({ usuarioId: 'usr_003', rol: 'recepcionista', centro: 'cen_001' });
let ds;

beforeEach(() => {
  setLatency(0);
  setClock(() => new Date(ISO).getTime());
  setOnlineOverride(true);
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: DATE, time: '11:00', iso: ISO });
});
afterAll(() => {
  setClock();
  setOnlineOverride(null);
});

describe('coincidencia con el dashboard (CA)', () => {
  for (const [nombre, session, centroId] of [
    ['centro', { ...CENTRAL, activeCenterId: 'cen_001' }, 'cen_001'],
    ['todos', CENTRAL, 'todos'],
  ])
    it(`mismo día y ${nombre}: emitidas y atendidas; 7 días: ausentismo y espera`, async () => {
      const dash = await reportService.getDashboard(session);
      const hoy = await reportService.getReport(session, { centroId, desde: DATE, hasta: DATE });
      expect(hoy.resumen.emitidas).toBe(dash.kpis.fichasHoy);
      expect(hoy.resumen.atendidas).toBe(dash.kpis.atendidos);
      expect(hoy.resumen.emitidas).toBeGreaterThan(0);
      const sem = await reportService.getReport(session, { centroId, desde: addDays(DATE, -6), hasta: DATE });
      expect(sem.resumen.ausentismoPct).toBe(dash.kpis.ausentismoPct);
      expect(sem.resumen.ausentes).toBe(dash.kpis.ausentesSemana);
      expect(sem.resumen.esperaPromedioMin).toBe(dash.kpis.esperaPromedioMin);
    });
});

describe('alcance y permisos', () => {
  it('solo el admin central elige “Todos”; los demás quedan en su centro', async () => {
    const r = await reportService.getReport(ADMIN_CSP, {});
    expect(r.filtros.centroId).toBe('cen_002');
    expect(r.porCentro).toBeNull();
    await expect(reportService.getReport(ADMIN_CSP, { centroId: 'todos' })).rejects.toMatchObject({
      code: 'PERMISO_DENEGADO',
    });
    await expect(reportService.getReport(ADMIN_CSP, { centroId: 'cen_001' })).rejects.toMatchObject({
      code: 'ACCESO_DENEGADO',
    });
    await expect(reportService.getReport(RECEP, {})).rejects.toMatchObject({ code: 'PERMISO_DENEGADO' });
    expect((await reportService.getReport(RESP_CSC, {})).filtros.centroId).toBe('cen_001');
    const opts = await reportService.getReportOptions(ADMIN_CSP, {});
    expect(opts.global).toBe(false);
    expect(opts.centros.map((c) => c.id)).toEqual(['cen_002']);
  });

  it('HU: comparar ausentismo entre centros del último mes', async () => {
    const r = await reportService.getReport(CENTRAL, {});
    expect(r.filtros).toMatchObject({ desde: addDays(DATE, -29), hasta: DATE, centroId: null });
    expect(r.porCentro.length).toBeGreaterThanOrEqual(5);
    const sum = (k) => r.porCentro.reduce((a, c) => a + c[k], 0);
    expect(sum('emitidas')).toBe(r.resumen.emitidas);
    expect(sum('ausentes')).toBe(r.resumen.ausentes);
    expect(sum('solicitudes')).toBe(r.resumen.solicitudes);
    for (const c of r.porCentro)
      if (c.cerradas) expect(c.ausentismoPct).toBeCloseTo((c.ausentes / c.cerradas) * 100, 0);
  });

  it('filtros por especialidad y médico', async () => {
    const all = await reportService.getReport(CENTRAL, { centroId: 'cen_001' });
    const sum = all.porEspecialidad.reduce((a, e) => a + e.emitidas, 0);
    expect(sum).toBe(all.resumen.emitidas);
    const mg = await reportService.getReport(CENTRAL, { centroId: 'cen_001', especialidadId: 'esp_001' });
    expect(mg.porEspecialidad.map((e) => e.especialidadId)).toEqual(['esp_001']);
    expect(mg.filtros.etiquetas.especialidad).toBe('Medicina General');
    const med = mg.porMedico[0].medicoId;
    const uno = await reportService.getReport(CENTRAL, {
      centroId: 'cen_001',
      especialidadId: 'esp_001',
      medicoId: med,
    });
    expect(uno.porMedico.map((m) => m.medicoId)).toEqual([med]);
    expect(uno.resumen.emitidas).toBe(mg.porMedico[0].emitidas);
  });
});

describe('período', () => {
  it('valida rango y agrupa por mes si supera 62 días', async () => {
    await expect(
      reportService.getReport(CENTRAL, { desde: DATE, hasta: addDays(DATE, -1) }),
    ).rejects.toMatchObject({
      code: 'VALIDACION',
    });
    await expect(
      reportService.getReport(CENTRAL, { desde: addDays(DATE, -400), hasta: DATE }),
    ).rejects.toMatchObject({
      code: 'VALIDACION',
    });
    const d = await reportService.getReport(CENTRAL, { desde: addDays(DATE, -6), hasta: DATE });
    expect(d.serie.granularidad).toBe('dia');
    expect(d.serie.filas).toHaveLength(7);
    const m = await reportService.getReport(CENTRAL, { desde: '2026-08-01', hasta: DATE });
    expect(m.serie.granularidad).toBe('mes');
    expect(m.serie.filas.map((x) => x.periodo)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(m.serie.filas.reduce((a, x) => a + x.emitidas, 0)).toBe(m.resumen.emitidas);
  });
});

describe('CSV para Excel (CA)', () => {
  it('celdas: coma decimal, comillas, inyección', () => {
    expect(csvCell(12.5)).toBe('12,5');
    expect(csvCell(null)).toBe('');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)");
    expect(csvCell('Pompeya')).toBe('Pompeya');
  });

  it('BOM UTF-8, separador ;, CRLF, tildes y fechas DD/MM/YYYY', async () => {
    const r = await reportService.getReport(CENTRAL, { desde: addDays(DATE, -6), hasta: DATE });
    const csv = reportCsv(r, 'Red Departamental de Salud — Demo');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
    expect(csv).not.toMatch(/[^\r]\n/);
    expect(csv).toContain('Período;03/11/2026 al 09/11/2026');
    expect(csv).toContain('Médico');
    expect(csv).toContain('Por centro');
    expect(csv).toMatch(/\r\n09\/11\/2026;\d+;/);
    expect(csv).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(toCsv([{ columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] }])).toBe('﻿A\r\n1\r\n');
  });
});
