import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { requestService, _resetConsultAttempts } from '@/services/requestService';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { getEnabledDates } from '@/services/rules/availability';
import { setClock, toIso } from '@/utils/dates';

const DATE = '2026-11-09';
const TIME = '07:30';
const ISO = toIso(DATE, TIME);
const NOW = { date: DATE, time: TIME };
let ds;

const persona = (over = {}) => ({
  tipoDocumento: 'CI',
  numeroDocumento: '7770001',
  complemento: '',
  nombres: 'Prueba',
  apellidos: 'Demo Uno',
  fechaNacimiento: '1985-03-10',
  sexo: '',
  telefono: '71234567',
  acepta: true,
  ...over,
});

const snap = () =>
  ds.snapshot([
    'centros',
    'centroEspecialidades',
    'especialidades',
    'horarios',
    'medicos',
    'medicoCentros',
    'excepcionesAgenda',
    'fichas',
    'solicitudes',
  ]);
const firstEnabled = (especialidadId = 'esp_001', centroId = 'cen_001') =>
  getEnabledDates(snap(), { centroId, especialidadId, now: NOW });

beforeEach(() => {
  setLatency(0);
  setClock(() => new Date(ISO).getTime());
  setOnlineOverride(true);
  _resetConsultAttempts();
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: DATE, time: TIME, iso: ISO });
});

afterAll(() => {
  setClock();
  setOnlineOverride(null);
});

describe('requestService.createRequest', () => {
  it('crea una solicitud pendiente que no reduce las fichas disponibles (RN-DIS-02)', async () => {
    const [d] = firstEnabled();
    const r = await requestService.createRequest({
      centroId: 'cen_001',
      especialidadId: 'esp_001',
      fecha: d.fecha,
      paciente: persona(),
    });
    expect(r.codigo).toMatch(/^CSC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(r).toMatchObject({
      estado: 'pendiente',
      medicoAsignado: false,
      paciente: 'Prueba D***',
      especialidad: 'Medicina General',
    });
    expect(r.ventana).toBeTruthy();
    const after = firstEnabled().find((x) => x.fecha === d.fecha);
    expect(after.publicosLibres).toBe(d.publicosLibres);
    const p = ds.list('pacientes').find((x) => x.numeroDocumento === '7770001');
    expect(p).toMatchObject({ origen: 'web', telefono: '+591 71234567', verificado: false });
    expect(
      ds.list('notificaciones').some((n) => n.tipo === 'solicitud_nueva' && n.mensaje.includes(r.codigo)),
    ).toBe(true);
  });

  it('rechaza duplicados para mismo centro + especialidad + fecha + documento (RN-SOL-02)', async () => {
    const [d] = firstEnabled();
    const input = { centroId: 'cen_001', especialidadId: 'esp_001', fecha: d.fecha, paciente: persona() };
    await requestService.createRequest(input);
    await expect(requestService.createRequest(input)).rejects.toMatchObject({ code: 'SOLICITUD_DUPLICADA' });
  });

  it('paciente existente: no sobrescribe datos y marca "por verificar" (RN-SOL-04)', async () => {
    const [d] = firstEnabled('esp_004');
    const r = await requestService.createRequest({
      centroId: 'cen_001',
      especialidadId: 'esp_004',
      fecha: d.fecha,
      paciente: persona({ numeroDocumento: '2345678', nombres: 'Otro', apellidos: 'Nombre' }),
    });
    expect(r.datosPorVerificar).toBe(true);
    const p = ds.list('pacientes').find((x) => x.numeroDocumento === '2345678');
    expect(p.nombres).toBe('Juan Carlos');
  });

  it('paciente bloqueado por inasistencia no puede solicitar (RN-SOL-14)', async () => {
    const [d] = firstEnabled();
    const jorge = ds.list('pacientes').find((x) => x.numeroDocumento === '5111032');
    expect(jorge.bloqueo.activo).toBe(true);
    await expect(
      requestService.createRequest({
        centroId: 'cen_001',
        especialidadId: 'esp_001',
        fecha: d.fecha,
        paciente: persona({ numeroDocumento: '5111032' }),
      }),
    ).rejects.toMatchObject({ code: 'PACIENTE_BLOQUEADO' });
  });

  it('límite de 3 solicitudes activas (RN-SOL-03)', async () => {
    const opciones = [];
    for (const esp of ['esp_001', 'esp_002', 'esp_004', 'esp_003', 'esp_006'])
      for (const d of firstEnabled(esp)) opciones.push({ esp, fecha: d.fecha });
    const uniq = opciones.filter((o, i) => opciones.findIndex((x) => x.esp === o.esp) === i).slice(0, 4);
    expect(uniq.length).toBe(4);
    for (const o of uniq.slice(0, 3))
      await requestService.createRequest({
        centroId: 'cen_001',
        especialidadId: o.esp,
        fecha: o.fecha,
        paciente: persona({ numeroDocumento: '7770009' }),
      });
    await expect(
      requestService.createRequest({
        centroId: 'cen_001',
        especialidadId: uniq[3].esp,
        fecha: uniq[3].fecha,
        paciente: persona({ numeroDocumento: '7770009' }),
      }),
    ).rejects.toMatchObject({ code: 'LIMITE_SOLICITUDES' });
  });

  it('si la disponibilidad cambia, falla y pide volver a la fecha (RN-SOL-01)', async () => {
    const [d] = firstEnabled();
    ds.transaction(['excepcionesAgenda'], (tx) =>
      tx.insert(
        'excepcionesAgenda',
        {
          tipo: 'feriado',
          alcance: 'global',
          centroId: null,
          medicoId: null,
          especialidadId: null,
          horarioId: null,
          horaInicio: null,
          horaFin: null,
          cuposAjustados: null,
          fechaInicio: d.fecha,
          fechaFin: d.fecha,
          motivo: 'Prueba',
        },
        'exc',
      ),
    );
    await expect(
      requestService.createRequest({
        centroId: 'cen_001',
        especialidadId: 'esp_001',
        fecha: d.fecha,
        paciente: persona(),
      }),
    ).rejects.toMatchObject({ code: 'FECHA_NO_DISPONIBLE', details: { volverA: 'fecha' } });
  });

  it('médico elegido sin cupos → MEDICO_NO_DISPONIBLE', async () => {
    const [d] = firstEnabled();
    await expect(
      requestService.createRequest({
        centroId: 'cen_001',
        especialidadId: 'esp_001',
        fecha: d.fecha,
        medicoPreferidoId: 'med_999',
        paciente: persona(),
      }),
    ).rejects.toMatchObject({ code: 'MEDICO_NO_DISPONIBLE' });
    const docs = await requestService.getDoctorOptions('cen_001', 'esp_001', d.fecha);
    expect(docs.length).toBeGreaterThan(0);
    const r = await requestService.createRequest({
      centroId: 'cen_001',
      especialidadId: 'esp_001',
      fecha: d.fecha,
      medicoPreferidoId: docs[0].id,
      paciente: persona(),
    });
    expect(r.medico).toBe(docs[0].nombre);
  });

  it('datos inválidos → errores por campo', async () => {
    const [d] = firstEnabled();
    await expect(
      requestService.createRequest({
        centroId: 'cen_001',
        especialidadId: 'esp_001',
        fecha: d.fecha,
        paciente: persona({ telefono: '123', fechaNacimiento: '2030-01-01', acepta: false }),
      }),
    ).rejects.toMatchObject({
      code: 'VALIDACION',
      details: {
        fields: {
          telefono: expect.any(String),
          fechaNacimiento: expect.any(String),
          acepta: expect.any(String),
        },
      },
    });
  });

  it('sin conexión no crea nada (RN-SOL-07)', async () => {
    const [d] = firstEnabled();
    const before = ds.list('solicitudes').length;
    setOnlineOverride(false);
    await expect(
      requestService.createRequest({
        centroId: 'cen_001',
        especialidadId: 'esp_001',
        fecha: d.fecha,
        paciente: persona(),
      }),
    ).rejects.toMatchObject({ code: 'SIN_CONEXION' });
    setOnlineOverride(true);
    expect(ds.list('solicitudes').length).toBe(before);
  });
});

describe('requestService — consulta y cancelación', () => {
  it('consulta con código y documento; datos enmascarados', async () => {
    const r = await requestService.getPublicStatus({ codigo: 'csc-7k3f9q', numeroDocumento: '1234567' });
    expect(r).toMatchObject({
      estado: 'confirmada',
      paciente: expect.stringMatching(/\*\*\*$/),
      medicoAsignado: true,
    });
    expect(r.ficha.codigo).toMatch(/^MG-\d{2}$/);
    expect(JSON.stringify(r)).not.toContain('1234567');
  });

  it('documento incorrecto → mensaje genérico; 5 fallos → bloqueo temporal (RN-PAC-04)', async () => {
    for (let i = 0; i < 5; i++)
      await expect(
        requestService.getPublicStatus({ codigo: 'CSC-7K3F9Q', numeroDocumento: '9999999' }),
      ).rejects.toMatchObject({ code: 'SOLICITUD_NO_ENCONTRADA' });
    await expect(
      requestService.getPublicStatus({ codigo: 'CSC-7K3F9Q', numeroDocumento: '1234567' }),
    ).rejects.toMatchObject({ code: 'DEMASIADOS_INTENTOS' });
  });

  it('pendiente: sin médico asignado, con franja estimada y cancelable', async () => {
    const r = await requestService.getPublicStatus({ codigo: 'CSC-PND2A4', numeroDocumento: '2345678' });
    expect(r).toMatchObject({ estado: 'pendiente', medicoAsignado: false, puedeCancelar: true, ficha: null });
  });

  it('cancelar ficha confirmada libera el cupo y no bloquea (RN-SOL-13)', async () => {
    const sol = ds.list('solicitudes').find((s) => s.codigo === 'CSC-7K3F9Q');
    const ficha = ds.get('fichas', sol.fichaId);
    const r = await requestService.cancelByCitizen({ codigo: 'CSC-7K3F9Q', numeroDocumento: '1234567' });
    expect(r.estado).toBe('cancelada');
    expect(ds.get('fichas', ficha.id).estado).toBe('cancelada');
    expect(ds.list('pacientes').find((p) => p.id === sol.pacienteId).bloqueo.activo).toBe(false);
    expect(ds.get('solicitudes', sol.id).historial.at(-1).usuarioId).toBe('publico');
    expect(ds.list('notificaciones').some((n) => n.tipo === 'cupo_liberado')).toBe(true);
    await expect(
      requestService.cancelByCitizen({ codigo: 'CSC-7K3F9Q', numeroDocumento: '1234567' }),
    ).rejects.toMatchObject({ code: 'CANCELACION_NO_PERMITIDA' });
  });

  it('no se cancela una ficha atendida ni con documento ajeno', async () => {
    await expect(
      requestService.cancelByCitizen({ codigo: 'CSC-SHR6P9', numeroDocumento: '5123443' }),
    ).rejects.toMatchObject({ code: 'CANCELACION_NO_PERMITIDA' });
    await expect(
      requestService.cancelByCitizen({ codigo: 'CSC-PND2A4', numeroDocumento: '1234567' }),
    ).rejects.toMatchObject({ code: 'SOLICITUD_NO_ENCONTRADA' });
  });

  it('ficha confirmada a menos de 2 h ya no se cancela', async () => {
    const sol = ds.list('solicitudes').find((s) => s.codigo === 'CSC-7K3F9Q');
    const f = ds.get('fichas', sol.fichaId);
    setClock(() => new Date(toIso(f.fecha, f.horaEstimada)).getTime() - 90 * 60_000);
    const r = await requestService.getPublicStatus({ codigo: 'CSC-7K3F9Q', numeroDocumento: '1234567' });
    expect(r.puedeCancelar).toBe(false);
    setClock(() => new Date(ISO).getTime());
  });
});
