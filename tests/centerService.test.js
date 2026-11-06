import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { centerService, centerToForm } from '@/services/centerService';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { setClock, toIso } from '@/utils/dates';

const ISO = toIso('2026-11-09', '10:00'); // lunes 10:00
let ds;
const CENTRAL = { usuarioId: 'usr_001', rol: 'admin_central', centrosPermitidos: [], activeCenterId: null };

beforeEach(() => {
  setLatency(0);
  setClock(() => new Date(ISO).getTime());
  setOnlineOverride(true);
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: '2026-11-09', time: '10:00', iso: ISO });
});

afterAll(() => {
  setClock();
  setOnlineOverride(null);
});

const nuevo = () => ({
  ...centerToForm(null),
  codigo: 'BEN-TRI-0099',
  codigoCorto: 'cnv',
  nombre: 'Centro de Salud Nuevo',
  direccion: 'Calle Demo 1',
  latitud: '-14.84',
  longitud: '-64.90',
  telefono: '+591 3 0000099',
});

describe('centerService', () => {
  it('portal: solo activos, con estado de apertura', async () => {
    const list = await centerService.listPublic();
    expect(list.map((c) => c.codigoCorto)).not.toContain('CSJ');
    expect(list.find((c) => c.codigoCorto === 'CSC').estadoApertura.abierto).toBe(true);
  });

  it('detalle por código corto o institucional; inactivo → null', async () => {
    const d = await centerService.getPublicDetail('csc');
    expect(d.nombre).toBe('Centro de Salud Central');
    expect(d.especialidades.length).toBeGreaterThan(3);
    expect(d.especialidades.some((e) => !e.aceptaSolicitudesPublicas)).toBe(true); // PSI solo ventanilla
    expect((await centerService.getPublicDetail('BEN-TRI-0001')).id).toBe('cen_001');
    expect(await centerService.getPublicDetail('CSJ')).toBeNull();
    expect(await centerService.getPublicDetail('XXX')).toBeNull();
  });

  it('crea con normalización y valida unicidad (RN-CEN-01)', async () => {
    const c = await centerService.create(CENTRAL, nuevo());
    expect(c).toMatchObject({ codigoCorto: 'CNV', activo: true, latitud: -14.84 });
    expect(c.horarioGeneral).toEqual([{ dias: [1, 2, 3, 4, 5], apertura: '07:00', cierre: '19:00' }]);
    await expect(centerService.create(CENTRAL, { ...nuevo(), codigo: 'BEN-TRI-0001' })).rejects.toMatchObject(
      {
        code: 'DUPLICADO',
        details: { fields: { codigo: expect.any(String), codigoCorto: expect.any(String) } },
      },
    );
  });

  it('rechaza datos inválidos con errores por campo', async () => {
    await expect(
      centerService.create(CENTRAL, { ...nuevo(), codigo: 'X', latitud: '10' }),
    ).rejects.toMatchObject({
      code: 'VALIDACION',
      details: { fields: { codigo: expect.any(String), latitud: expect.any(String) } },
    });
    const sinDias = nuevo();
    sinDias.horario = sinDias.horario.map((d) => ({ ...d, abierto: false }));
    await expect(centerService.create(CENTRAL, sinDias)).rejects.toMatchObject({ code: 'VALIDACION' });
  });

  it('edita sin permitir cambiar el código corto (RN-CEN-06)', async () => {
    const central = ds.get('centros', 'cen_001');
    const form = centerToForm(central);
    const upd = await centerService.update(CENTRAL, 'cen_001', { ...form, telefono: '+591 3 1111111' });
    expect(upd.telefono).toBe('+591 3 1111111');
    expect(upd.horarioGeneral).toEqual(central.horarioGeneral);
    expect(upd.config.factorLimitePendientes).toBe(central.config.factorLimitePendientes);
    await expect(
      centerService.update(CENTRAL, 'cen_001', { ...form, codigoCorto: 'ZZZ' }),
    ).rejects.toMatchObject({
      code: 'VALIDACION',
    });
  });

  it('desactivar no cancela fichas futuras (RN-CEN-04) y lo oculta del portal', async () => {
    const before = centerService.countFutureConfirmed(CENTRAL, 'cen_002');
    expect(before).toBeGreaterThan(0);
    await centerService.setActive(CENTRAL, 'cen_002', false);
    expect(centerService.countFutureConfirmed(CENTRAL, 'cen_002')).toBe(before);
    expect((await centerService.listPublic()).some((c) => c.id === 'cen_002')).toBe(false);
    expect(centerService.getActiveSync('cen_002')).toBeNull();
  });

  it('sin permiso centros.gestionar → PERMISO_DENEGADO (RN-CEN-02)', async () => {
    const recep = {
      usuarioId: 'usr_003',
      rol: 'recepcionista',
      centrosPermitidos: ['cen_001'],
      activeCenterId: 'cen_001',
    };
    await expect(centerService.setActive(recep, 'cen_002', false)).rejects.toMatchObject({
      code: 'PERMISO_DENEGADO',
    });
    await expect(centerService.listAll(null)).rejects.toMatchObject({ code: 'ACCESO_DENEGADO' });
  });

  it('sin conexión no guarda (RN-OFF-01)', async () => {
    setOnlineOverride(false);
    await expect(centerService.setActive(CENTRAL, 'cen_002', false)).rejects.toMatchObject({
      code: 'SIN_CONEXION',
    });
    setOnlineOverride(true);
  });
});
