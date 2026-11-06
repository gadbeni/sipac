import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { agendaService } from '@/services/agendaService';
import { doctorAdminService } from '@/services/doctorAdminService';
import { specialtyAdminService } from '@/services/specialtyAdminService';
import { requestService } from '@/services/requestService';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { validateIntegrity } from '@/services/rules/integrity';
import { getEnabledDates } from '@/services/rules/availability';
import { centerSpecialties, doctorsOnDuty } from '@/services/rules/portal';
import { COLLECTIONS } from '@/config/constants';
import { addDays, isoWeekday, setClock, toIso } from '@/utils/dates';

const DATE = '2026-11-09'; // lunes
const ISO = toIso(DATE, '07:00');
let ds;
const S = (o) => ({
  usuarioId: 'u',
  centrosPermitidos: [o.centro],
  activeCenterId: o.centro,
  centroId: o.centro,
  ...o,
});
const CENTRAL = {
  usuarioId: 'usr_001',
  rol: 'admin_central',
  centrosPermitidos: ['cen_001', 'cen_002', 'cen_003', 'cen_004', 'cen_005'],
  activeCenterId: 'cen_001',
};
const ADMIN_CSC = S({ usuarioId: 'usr_002', rol: 'admin_centro', centro: 'cen_001' });
const ADMIN_CSP = S({ usuarioId: 'usr_006', rol: 'admin_centro', centro: 'cen_002' });
const RESP = S({ usuarioId: 'usr_004', rol: 'responsable_medico', centro: 'cen_001' });
const RECEP = S({ usuarioId: 'usr_003', rol: 'recepcionista', centro: 'cen_001' });
const all = () => ds.snapshot(Object.values(COLLECTIONS));
const now = { date: DATE, time: '07:00' };

beforeEach(() => {
  setLatency(0);
  setClock(() => new Date(ISO).getTime());
  setOnlineOverride(true);
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: DATE, time: '07:00', iso: ISO });
});
afterAll(() => {
  setClock();
  setOnlineOverride(null);
});

const base = (over = {}) => {
  const mc = all().medicoCentros.find((x) => x.id === 'mc_001'); // med_001 en Central, MG
  return {
    medicoCentroId: mc.id,
    especialidadId: 'esp_001',
    consultorioId: 'con_001',
    diaSemana: 7,
    horaInicio: '08:00',
    horaFin: '10:00',
    duracionConsultaMin: 20,
    cupos: 6,
    cuposPublicos: 4,
    ...over,
  };
};

describe('horarios (RN-HOR-01..05, RN-MC-05)', () => {
  it('solapamiento del mismo médico en otro centro: error que indica el centro', async () => {
    const otro = all().horarios.find((h) => h.medicoId === 'med_001' && h.centroId === 'cen_002' && h.activo);
    await expect(
      agendaService.createSchedule(
        ADMIN_CSC,
        base({
          diaSemana: otro.diaSemana,
          horaInicio: otro.horaInicio,
          horaFin: otro.horaFin,
          consultorioId: 'con_003',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'VALIDACION',
      details: { fields: { horaInicio: expect.stringContaining('Centro de Salud Pompeya') } },
    });
  });

  it('capacidad, cupos públicos, especialidad no ejercida (RN-HOR-02, RN-MED-04)', async () => {
    await expect(agendaService.createSchedule(ADMIN_CSC, base({ cupos: 10 }))).rejects.toMatchObject({
      details: { fields: { cupos: expect.stringContaining('no caben') } },
    });
    await expect(agendaService.createSchedule(ADMIN_CSC, base({ cuposPublicos: 9 }))).rejects.toMatchObject({
      details: { fields: { cuposPublicos: expect.any(String) } },
    });
    await expect(
      agendaService.createSchedule(ADMIN_CSC, base({ especialidadId: 'esp_004' })),
    ).rejects.toMatchObject({
      details: { fields: { especialidadId: expect.stringContaining('RN-MED-04') } },
    });
  });

  it('fuera del horario del centro: advertencia que exige confirmar (RN-HOR-04)', async () => {
    await expect(agendaService.createSchedule(ADMIN_CSC, base())).rejects.toMatchObject({
      code: 'ADVERTENCIAS',
    }); // domingo
    const h = await agendaService.createSchedule(ADMIN_CSC, base(), { confirmar: true });
    expect(h).toMatchObject({ diaSemana: 7, medicoId: 'med_001', activo: true });
    expect(validateIntegrity(all())).toEqual([]);
  });

  it('consultorio ocupado (RN-HOR-03)', async () => {
    const h = all().horarios.find(
      (x) => x.centroId === 'cen_001' && x.activo && x.medicoId !== 'med_001' && x.diaSemana === 2,
    );
    await expect(
      agendaService.createSchedule(
        ADMIN_CSC,
        base({
          diaSemana: 2,
          horaInicio: h.horaInicio,
          horaFin: addMin(h.horaInicio, 120),
          consultorioId: h.consultorioId,
        }),
      ),
    ).rejects.toMatchObject({ details: { fields: { consultorioId: expect.stringContaining('RN-HOR-03') } } });
  });

  it('con fichas futuras no se cambia la estructura; reducir cupos advierte (RN-HOR-05)', async () => {
    const f = all().fichas.find(
      (x) => x.centroId === 'cen_001' && x.fecha > DATE && x.estado === 'confirmada',
    );
    const h = all().horarios.find((x) => x.id === f.horarioId);
    await expect(
      agendaService.updateSchedule(ADMIN_CSC, h.id, { horaInicio: '06:00' }),
    ).rejects.toMatchObject({
      details: { fields: { diaSemana: expect.stringContaining('fichas futuras') } },
    });
    await expect(
      agendaService.updateSchedule(ADMIN_CSC, h.id, { cupos: 1, cuposPublicos: 1 }),
    ).rejects.toMatchObject({ code: 'ADVERTENCIAS' });
    const u = await agendaService.updateSchedule(
      ADMIN_CSC,
      h.id,
      { cupos: 1, cuposPublicos: 1 },
      { confirmar: true },
    );
    expect(u.cupos).toBe(1);
    expect(ds.get('fichas', f.id).estado).toBe('confirmada'); // se respetan
  });

  it('permisos y aislamiento', async () => {
    await expect(agendaService.createSchedule(RECEP, base())).rejects.toMatchObject({
      code: 'PERMISO_DENEGADO',
    });
    const h = all().horarios.find((x) => x.centroId === 'cen_001');
    await expect(agendaService.updateSchedule(ADMIN_CSP, h.id, { cupos: 2 })).rejects.toMatchObject({
      code: 'ACCESO_DENEGADO',
    });
  });
});

function addMin(hhmm, m) {
  const [a, b] = hhmm.split(':').map(Number);
  const t = a * 60 + b + m;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

describe('médicos (RN-MED-01..04)', () => {
  const nuevo = {
    nombres: 'Nuevo',
    apellidos: 'Profesional Demo',
    tipoDocumento: 'CI',
    numeroDocumento: '9100001',
    registroProfesional: 'MP-DEMO-9001',
    especialidadIds: ['esp_001'],
    telefono: '',
    email: '',
  };

  it('documento existente → DUPLICADO con el médico; se vincula sin duplicar', async () => {
    const m = ds.get('medicos', 'med_002');
    await expect(
      doctorAdminService.create(ADMIN_CSP, { ...nuevo, numeroDocumento: m.numeroDocumento }),
    ).rejects.toMatchObject({ code: 'DUPLICADO', details: { medicoId: 'med_002' } });
    expect(
      doctorAdminService.findByDocument(ADMIN_CSP, {
        tipoDocumento: 'CI',
        numeroDocumento: m.numeroDocumento,
      }).id,
    ).toBe('med_002');
    const antes = ds.list('medicos').length;
    await doctorAdminService.linkToCenter(ADMIN_CSP, 'med_002', {
      especialidadIds: ['esp_001'],
      cargo: 'Rotación',
    });
    expect(ds.list('medicos').length).toBe(antes);
    expect(
      ds
        .list('medicoCentros')
        .filter((x) => x.medicoId === 'med_002')
        .map((x) => x.centroId)
        .sort(),
    ).toEqual(['cen_001', 'cen_002']);
    await expect(
      doctorAdminService.linkToCenter(ADMIN_CSP, 'med_002', {
        especialidadIds: ['esp_001'],
        cargo: 'Rotación',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });
  });

  it('crear nuevo con vínculo al centro de trabajo', async () => {
    const m = await doctorAdminService.create(ADMIN_CSC, nuevo);
    expect(ds.list('medicoCentros').find((x) => x.medicoId === m.id)).toMatchObject({
      centroId: 'cen_001',
      activo: true,
    });
    await expect(
      doctorAdminService.create(ADMIN_CSC, { ...nuevo, numeroDocumento: '9100002' }),
    ).rejects.toMatchObject({ details: { fields: { registroProfesional: expect.any(String) } } });
  });

  it('desactivar el vínculo en un centro no afecta el otro (CA)', async () => {
    const pompeya = ds
      .list('medicoCentros')
      .find((x) => x.medicoId === 'med_001' && x.centroId === 'cen_002');
    expect(typeof doctorAdminService.linkImpact(ADMIN_CSP, pompeya.id)).toBe('number');
    await doctorAdminService.setLinkActive(ADMIN_CSP, pompeya.id, false);
    const central = ds
      .list('medicoCentros')
      .find((x) => x.medicoId === 'med_001' && x.centroId === 'cen_001');
    expect(central.activo).toBe(true);
    const lunes = DATE;
    expect(doctorsOnDuty(all(), 'cen_002', lunes, now).some((d) => d.id === 'med_001')).toBe(false);
    const enCentral = all().horarios.some(
      (h) =>
        h.medicoId === 'med_001' && h.centroId === 'cen_001' && h.diaSemana === isoWeekday(lunes) && h.activo,
    );
    expect(doctorsOnDuty(all(), 'cen_001', lunes, now).some((d) => d.id === 'med_001')).toBe(enCentral);
    await expect(doctorAdminService.setLinkActive(ADMIN_CSC, pompeya.id, true)).rejects.toMatchObject({
      code: 'ACCESO_DENEGADO',
    });
    await expect(doctorAdminService.setDoctorActive(ADMIN_CSC, 'med_001', false)).rejects.toMatchObject({
      code: 'PERMISO_DENEGADO',
    });
  });

  it('no se quita una especialidad con horarios activos', async () => {
    await expect(
      doctorAdminService.updateLink(ADMIN_CSC, 'mc_001', { especialidadIds: ['esp_008'], cargo: 'Planta' }),
    ).rejects.toMatchObject({ code: 'VALIDACION' });
  });
});

describe('especialidades (RN-ESP-01..03)', () => {
  it('desactivar en el centro la oculta del portal y bloquea solicitudes', async () => {
    await specialtyAdminService.configure(RESP, 'esp_002', {
      activo: false,
      aceptaSolicitudesPublicas: true,
      asignacionMedico: 'elegible',
    });
    expect(centerSpecialties(all(), 'cen_001', now).some((e) => e.codigo === 'PED')).toBe(false);
    expect(getEnabledDates(all(), { centroId: 'cen_001', especialidadId: 'esp_002', now })).toEqual([]);
    const list = await specialtyAdminService.listForCenter(RESP);
    expect(list.find((e) => e.codigo === 'PED')).toMatchObject({ ofrecida: false, visiblePortal: false });
  });

  it('catálogo global: solo admin central; el código no cambia', async () => {
    await expect(
      specialtyAdminService.createCatalog(ADMIN_CSC, {
        codigo: 'DER',
        nombre: 'Dermatología',
        descripcion: 'Piel y anexos',
        icono: 'MedicalServices',
      }),
    ).rejects.toMatchObject({ code: 'PERMISO_DENEGADO' });
    const e = await specialtyAdminService.createCatalog(CENTRAL, {
      codigo: 'der',
      nombre: 'Dermatología',
      descripcion: 'Piel y anexos',
      icono: 'MedicalServices',
    });
    expect(e.codigo).toBe('DER');
    await expect(
      specialtyAdminService.updateCatalog(CENTRAL, e.id, {
        codigo: 'DRM',
        nombre: 'Dermatología',
        descripcion: 'Piel y anexos',
        icono: 'MedicalServices',
      }),
    ).rejects.toMatchObject({ details: { fields: { codigo: expect.any(String) } } });
  });
});

describe('novedades de agenda (RN-AGE-01/02)', () => {
  it('feriado global vacía la disponibilidad pública de ese día en todos los centros (CA)', async () => {
    const fecha = addDays(DATE, 2);
    const antes = ['cen_001', 'cen_002', 'cen_003'].map((c) =>
      getEnabledDates(all(), { centroId: c, especialidadId: 'esp_001', now }).some((d) => d.fecha === fecha),
    );
    expect(antes.some(Boolean)).toBe(true);
    await expect(
      agendaService.createException(ADMIN_CSC, {
        tipo: 'feriado',
        alcance: 'global',
        fechaInicio: fecha,
        fechaFin: fecha,
        motivo: 'Prueba',
      }),
    ).rejects.toMatchObject({ code: 'VALIDACION' });
    const prev = await agendaService.previewException(CENTRAL, {
      tipo: 'feriado',
      alcance: 'global',
      fechaInicio: fecha,
      fechaFin: fecha,
      motivo: 'Feriado de prueba',
    });
    expect(prev.afectadas.length).toBeGreaterThan(0);
    await expect(
      agendaService.createException(CENTRAL, {
        tipo: 'feriado',
        alcance: 'global',
        fechaInicio: fecha,
        fechaFin: fecha,
        motivo: 'Feriado de prueba',
      }),
    ).rejects.toMatchObject({ details: { afectadas: prev.afectadas.length } });
    const r = await agendaService.createException(
      CENTRAL,
      {
        tipo: 'feriado',
        alcance: 'global',
        fechaInicio: fecha,
        fechaFin: fecha,
        motivo: 'Feriado de prueba',
      },
      { resolucion: 'reprogramar' },
    );
    expect(r.reprogramadas.length + r.canceladas.length).toBe(prev.afectadas.length);
    for (const c of ['cen_001', 'cen_002', 'cen_003', 'cen_005']) {
      for (const e of ['esp_001', 'esp_002'])
        expect(
          getEnabledDates(all(), { centroId: c, especialidadId: e, now }).some((d) => d.fecha === fecha),
        ).toBe(false);
    }
    expect(
      all().fichas.some((f) => f.fecha === fecha && ['confirmada', 'en_espera'].includes(f.estado)),
    ).toBe(false);
    expect(validateIntegrity(all())).toEqual([]);
  });

  it('permiso de un médico: cancelar en lote y desaparece de médicos de turno', async () => {
    const f = all().fichas.find(
      (x) => x.centroId === 'cen_001' && x.fecha > DATE && x.estado === 'confirmada',
    );
    const r = await agendaService.createException(
      RESP,
      {
        tipo: 'permiso',
        alcance: 'medico',
        medicoId: f.medicoId,
        fechaInicio: f.fecha,
        fechaFin: f.fecha,
        motivo: 'Capacitación',
      },
      { resolucion: 'cancelar' },
    );
    expect(r.canceladas.length).toBeGreaterThan(0);
    expect(ds.get('fichas', f.id).estado).toBe('cancelada');
    expect(doctorsOnDuty(all(), 'cen_001', f.fecha, now).some((d) => d.id === f.medicoId)).toBe(false);
    expect(ds.list('notificaciones').some((n) => n.tipo === 'novedad_agenda')).toBe(true);
    expect(validateIntegrity(all())).toEqual([]);
  });

  it('ajuste de cupos: solo afecta las que exceden el nuevo máximo', async () => {
    const f = all().fichas.find(
      (x) => x.centroId === 'cen_001' && x.fecha > DATE && x.estado === 'confirmada',
    );
    const ocupadas = all().fichas.filter(
      (x) =>
        x.horarioId === f.horarioId &&
        x.fecha === f.fecha &&
        ['confirmada', 'en_espera', 'llamada', 'en_atencion', 'atendida', 'ausente'].includes(x.estado),
    ).length;
    const prev = await agendaService.previewException(ADMIN_CSC, {
      tipo: 'ajuste_cupos',
      alcance: 'horario',
      horarioId: f.horarioId,
      cuposAjustados: Math.max(0, ocupadas - 1),
      fechaInicio: f.fecha,
      fechaFin: f.fecha,
      motivo: 'Reducción',
    });
    expect(prev.afectadas.length).toBe(Math.min(1, ocupadas));
  });

  it('sin fichas afectadas se registra directo; eliminar restaura la disponibilidad', async () => {
    const fecha = addDays(DATE, 13);
    const r = await agendaService.createException(ADMIN_CSC, {
      tipo: 'bloqueo',
      alcance: 'especialidad',
      especialidadId: 'esp_006',
      fechaInicio: fecha,
      fechaFin: fecha,
      motivo: 'Mantenimiento',
    });
    const habil = () =>
      getEnabledDates(all(), {
        centroId: 'cen_001',
        especialidadId: 'esp_006',
        now: { date: DATE, time: '07:00' },
      }).some((d) => d.fecha === fecha);
    expect(habil()).toBe(false);
    await agendaService.deleteException(ADMIN_CSC, r.excepcion.id);
    const tieneHorario = all().horarios.some(
      (h) => h.centroId === 'cen_001' && h.especialidadId === 'esp_006' && h.diaSemana === isoWeekday(fecha),
    );
    expect(habil()).toBe(tieneHorario);
  });

  it('agenda semanal muestra ocupados/efectivos y cambia al emitir fichas', async () => {
    const days = await agendaService.getAgenda(ADMIN_CSC, { desde: DATE, hasta: addDays(DATE, 6) });
    expect(days).toHaveLength(7);
    const b = days
      .find((d) => d.bloques.some((x) => x.libres > 1 && x.publicosLibres > 0))
      .bloques.find((x) => x.libres > 1 && x.publicosLibres > 0);
    const fecha = b.fecha;
    const r = await requestService
      .createRequest({
        centroId: 'cen_001',
        especialidadId: b.especialidadId,
        fecha,
        paciente: {
          tipoDocumento: 'CI',
          numeroDocumento: '7300001',
          nombres: 'Agenda',
          apellidos: 'Prueba',
          fechaNacimiento: '1990-01-01',
          sexo: '',
          telefono: '71111111',
          acepta: true,
        },
      })
      .catch(() => null);
    const { requestAdminService } = await import('@/services/requestAdminService');
    if (r) {
      const s = ds.list('solicitudes').find((x) => x.codigo === r.codigo);
      await requestAdminService.approve(ADMIN_CSC, s.id, { horarioId: b.horarioId });
      const again = await agendaService.getAgenda(ADMIN_CSC, { desde: fecha, hasta: fecha });
      expect(again[0].bloques.find((x) => x.horarioId === b.horarioId).ocupados).toBe(b.ocupados + 1);
    }
  });
});
