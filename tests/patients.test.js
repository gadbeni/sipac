import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { patientService, patientEditSchema } from '@/services/patientService';
import { requestService } from '@/services/requestService';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { getEnabledDates } from '@/services/rules/availability';
import { setClock, toIso } from '@/utils/dates';

const DATE = '2026-11-09';
const ISO = toIso(DATE, '07:30');
let ds;
const S = (o) => ({ centrosPermitidos: [o.centro], activeCenterId: o.centro, centroId: o.centro, ...o });
const RECEP_CSC = S({ usuarioId: 'usr_003', rol: 'recepcionista', centro: 'cen_001' });
const RECEP_CSP = S({ usuarioId: 'usr_007', rol: 'recepcionista', centro: 'cen_002' });
const ADMIN_CSP = S({ usuarioId: 'usr_006', rol: 'admin_centro', centro: 'cen_002' });
const CENTRAL = { usuarioId: 'usr_001', rol: 'admin_central', centrosPermitidos: [], activeCenterId: null };
const MEDICO = {
  usuarioId: 'usr_005',
  rol: 'medico',
  medicoId: 'med_001',
  centrosPermitidos: ['cen_001', 'cen_002'],
  activeCenterId: 'cen_001',
};
const RESP = S({ usuarioId: 'usr_004', rol: 'responsable_medico', centro: 'cen_001' });

beforeEach(() => {
  setLatency(0);
  setClock(() => new Date(ISO).getTime());
  setOnlineOverride(true);
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: DATE, time: '07:30', iso: ISO });
});
afterAll(() => {
  setClock();
  setOnlineOverride(null);
});

const solo = (centro) => {
  const by = new Map();
  for (const f of ds.list('fichas'))
    (by.get(f.pacienteId) || by.set(f.pacienteId, new Set()).get(f.pacienteId)).add(f.centroId);
  for (const s of ds.list('solicitudes'))
    (by.get(s.pacienteId) || by.set(s.pacienteId, new Set()).get(s.pacienteId)).add(s.centroId);
  return [...by.entries()].filter(([, cs]) => cs.size === 1 && cs.has(centro)).map(([id]) => id);
};

describe('visibilidad por centro (RN-PAC-03)', () => {
  it('Pompeya no ve pacientes que solo tienen registros en Central (CA)', async () => {
    const soloCentral = solo('cen_001');
    expect(soloCentral.length).toBeGreaterThan(0);
    const listaCSP = await patientService.list(RECEP_CSP);
    const ids = new Set(listaCSP.map((p) => p.id));
    expect(soloCentral.some((id) => ids.has(id))).toBe(false);
    await expect(patientService.getDetail(RECEP_CSP, soloCentral[0])).rejects.toMatchObject({
      code: 'ACCESO_DENEGADO',
    });
    expect((await patientService.list(RECEP_CSC)).some((p) => p.id === soloCentral[0])).toBe(true);
  });

  it('mismo paciente en dos centros: cada centro ve solo su historial', async () => {
    const mateo = ds.list('pacientes').find((p) => p.numeroDocumento === '5123443');
    const a = await patientService.getDetail(RECEP_CSC, mateo.id);
    const b = await patientService.getDetail(RECEP_CSP, mateo.id);
    expect(a.solicitudes.every((s) => s.centro === 'Centro de Salud Central')).toBe(true);
    expect(b.solicitudes.every((s) => s.centro === 'Centro de Salud Pompeya')).toBe(true);
    expect(a.solicitudes.map((s) => s.codigo)).toContain('CSC-SHR6P9');
    expect(b.solicitudes.map((s) => s.codigo)).toEqual(['CSP-SHR7Q2']);
    const all = await patientService.getDetail(CENTRAL, mateo.id);
    expect(all.solicitudes.length).toBe(a.solicitudes.length + b.solicitudes.length);
  });

  it('médico: solo pacientes de sus fichas, sin solicitudes', async () => {
    const list = await patientService.list(MEDICO);
    const mine = new Set(
      ds
        .list('fichas')
        .filter((f) => f.medicoId === 'med_001' && f.centroId === 'cen_001')
        .map((f) => f.pacienteId),
    );
    expect(list.every((p) => mine.has(p.id))).toBe(true);
    expect((await patientService.getDetail(MEDICO, list[0].id)).solicitudes).toEqual([]);
    await expect(patientService.update(MEDICO, list[0].id, {})).rejects.toMatchObject({
      code: 'PERMISO_DENEGADO',
    });
  });

  it('búsqueda por CI y filtros', async () => {
    const r = await patientService.list(RECEP_CSC, { q: '1234567' });
    expect(r.map((p) => p.nombre)).toEqual(['María Pérez Suárez']);
    const bloq = await patientService.list(RECEP_CSC, { filtro: 'bloqueados' });
    expect(bloq.length).toBeGreaterThan(0);
    expect(bloq.every((p) => p.bloqueado)).toBe(true);
  });
});

describe('edición, verificación y auditoría', () => {
  const pac = () => ds.list('pacientes').find((p) => p.numeroDocumento === '1234567');
  const form = (p, over = {}) => ({
    tipoDocumento: p.tipoDocumento,
    numeroDocumento: p.numeroDocumento,
    complemento: p.complemento || '',
    nombres: p.nombres,
    apellidos: p.apellidos,
    fechaNacimiento: p.fechaNacimiento,
    sexo: p.sexo || '',
    telefono: p.telefono,
    ...over,
  });

  it('editar queda registrado con usuario, fecha y campos (CA)', async () => {
    const p = pac();
    await patientService.update(RECEP_CSC, p.id, form(p, { telefono: '77777777' }));
    const a = ds.get('pacientes', p.id).auditoria.at(-1);
    expect(a).toMatchObject({ usuarioId: 'usr_003', fecha: expect.any(String), accion: 'edicion' });
    expect(a.cambios).toEqual([{ campo: 'telefono', antes: p.telefono, despues: '+591 77777777' }]);
    const d = await patientService.getDetail(RECEP_CSC, p.id);
    expect(d.auditoria[0].usuario).toBe('Rosa Vaca (demo)');
  });

  it('documento duplicado rechazado; validación por campo', async () => {
    const p = pac();
    await expect(
      patientService.update(RECEP_CSC, p.id, form(p, { numeroDocumento: '2345678' })),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });
    await expect(patientService.update(RECEP_CSC, p.id, form(p, { telefono: '12' }))).rejects.toMatchObject({
      details: { fields: { telefono: expect.any(String) } },
    });
    await expect(patientService.update(RESP, p.id, form(p))).rejects.toMatchObject({
      code: 'PERMISO_DENEGADO',
    });
  });

  it('marcar verificado', async () => {
    const p = pac();
    await patientService.setVerified(RECEP_CSC, p.id, true);
    expect(ds.get('pacientes', p.id)).toMatchObject({ verificado: true });
    expect(ds.get('pacientes', p.id).auditoria.at(-1).accion).toBe('verificacion');
  });

  it('sin campos clínicos en el esquema ni en el modelo (CA)', () => {
    const clinicos =
      /diagn|motivoConsulta|sintoma|alergia|tratamiento|historiaClinica|clinic|enfermedad|medicac/i;
    expect(Object.keys(patientEditSchema.shape).filter((k) => clinicos.test(k))).toEqual([]);
    for (const p of ds.list('pacientes').slice(0, 50))
      expect(Object.keys(p).filter((k) => clinicos.test(k))).toEqual([]);
  });
});

describe('habilitación de bloqueados (RN-PAC-07)', () => {
  const jorge = () => ds.list('pacientes').find((p) => p.numeroDocumento === '5111032');

  it('solo central o el centro de la inasistencia; nota obligatoria; permite volver a solicitar', async () => {
    const j = jorge();
    expect(j.bloqueo).toMatchObject({ activo: true, centroId: 'cen_001' });
    // Pompeya no lo ve (solo tiene registros en Central) → acceso denegado igual
    await expect(
      patientService.unblock(ADMIN_CSP, j.id, { nota: 'Prueba de habilitación' }),
    ).rejects.toMatchObject({ code: 'ACCESO_DENEGADO' });
    await expect(patientService.unblock(RECEP_CSC, j.id, { nota: '' })).rejects.toMatchObject({
      code: 'VALIDACION',
    });
    await patientService.unblock(RECEP_CSC, j.id, { nota: 'Justificó la inasistencia' });
    const p = ds.get('pacientes', j.id);
    expect(p.bloqueo.activo).toBe(false);
    expect(p.historialBloqueos.at(-1)).toMatchObject({
      accion: 'habilitacion',
      usuarioId: 'usr_003',
      nota: 'Justificó la inasistencia',
    });
    const [d] = getEnabledDates(
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
      ]),
      { centroId: 'cen_001', especialidadId: 'esp_004', now: { date: DATE, time: '07:30' } },
    );
    const r = await requestService.createRequest({
      centroId: 'cen_001',
      especialidadId: 'esp_004',
      fecha: d.fecha,
      paciente: {
        tipoDocumento: 'CI',
        numeroDocumento: '5111032',
        nombres: p.nombres,
        apellidos: p.apellidos,
        fechaNacimiento: p.fechaNacimiento,
        sexo: '',
        telefono: p.telefono,
        acepta: true,
      },
    });
    expect(r.estado).toBe('pendiente');
  });
});

describe('datos por verificar (RN-SOL-04)', () => {
  it('portal guarda lo ingresado; recepción aplica o mantiene', async () => {
    const s = ds.list('solicitudes').find((x) => x.codigo === 'CSC-X5T4C6');
    expect(s.datosPorVerificar).toBe(true);
    const d = await patientService.getDetail(RECEP_CSC, s.pacienteId);
    expect(d.porVerificar.map((x) => x.codigo)).toEqual(['CSC-X5T4C6']);
    expect(d.porVerificar[0].datosIngresados.telefono).toBe('+591 76543210');
    await patientService.resolveDataCheck(RECEP_CSC, s.id, 'aplicar');
    expect(ds.get('pacientes', s.pacienteId).telefono).toBe('+591 76543210');
    expect(ds.get('solicitudes', s.id).datosPorVerificar).toBe(false);
    expect(ds.get('pacientes', s.pacienteId).auditoria.at(-1).accion).toContain('CSC-X5T4C6');
    await expect(patientService.resolveDataCheck(RECEP_CSC, s.id, 'mantener')).rejects.toMatchObject({
      code: 'NO_ENCONTRADO',
    });
  });
});
