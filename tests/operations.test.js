import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { requestAdminService } from '@/services/requestAdminService';
import { appointmentService } from '@/services/appointmentService';
import { requestService } from '@/services/requestService';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { validateIntegrity } from '@/services/rules/integrity';
import { computeBlock, buildOccupancyIndex } from '@/services/rules/availability';
import { createRandom } from '@/utils/random';
import { COLLECTIONS } from '@/config/constants';
import { addDays, isoWeekday, setClock, toIso } from '@/utils/dates';

const DATE = '2026-11-09'; // lunes
const TIME = '07:00';
const ISO = toIso(DATE, TIME);
let ds;
const RECEP = {
  usuarioId: 'usr_003',
  rol: 'recepcionista',
  centrosPermitidos: ['cen_001'],
  activeCenterId: 'cen_001',
  centroId: 'cen_001',
};
const RECEP_POMPEYA = {
  usuarioId: 'usr_007',
  rol: 'recepcionista',
  centrosPermitidos: ['cen_002'],
  activeCenterId: 'cen_002',
  centroId: 'cen_002',
};
const MEDICO = {
  usuarioId: 'usr_005',
  rol: 'medico',
  medicoId: 'med_001',
  centrosPermitidos: ['cen_001', 'cen_002'],
  activeCenterId: 'cen_001',
};

const all = () => ds.snapshot(Object.values(COLLECTIONS));
const integrity = () => validateIntegrity(all());
const block = (horarioId, fecha) => {
  const s = all();
  return computeBlock(
    s,
    s.horarios.find((h) => h.id === horarioId),
    fecha,
    { occupancy: buildOccupancyIndex(s.fichas), pending: new Map() },
  );
};
const persona = (doc, over = {}) => ({
  tipoDocumento: 'CI',
  numeroDocumento: doc,
  complemento: '',
  nombres: 'Paciente',
  apellidos: 'De Prueba',
  fechaNacimiento: '1980-05-05',
  sexo: '',
  telefono: '71234567',
  ...over,
});

/** Inserta solicitudes web pendientes (sin pasar por el portal, que limita por demanda). */
let seq = 0;
async function pendings(n, especialidadId = 'esp_001', fecha) {
  const out = [];
  ds.transaction(['pacientes', 'solicitudes'], (tx) => {
    for (let i = 0; i < n; i++) {
      seq += 1;
      const p = tx.insert(
        'pacientes',
        {
          ...persona(`55${String(seq).padStart(5, '0')}`),
          verificado: false,
          bloqueo: { activo: false, motivo: null, fichaId: null, centroId: null, desde: null },
          historialBloqueos: [],
          origen: 'web',
        },
        'pac',
      );
      out.push(
        tx.insert(
          'solicitudes',
          {
            codigo: `CSC-T${String(seq).padStart(5, '0')}`,
            centroId: 'cen_001',
            pacienteId: p.id,
            especialidadId,
            fechaSolicitada: fecha,
            medicoPreferidoId: null,
            canal: 'web',
            estado: 'pendiente',
            motivoEstado: null,
            fichaId: null,
            datosPorVerificar: false,
            historial: [],
            creadoPor: 'publico',
          },
          'sol',
        ),
      );
    }
  });
  return out;
}

beforeEach(() => {
  setLatency(0);
  setClock(() => new Date(ISO).getTime());
  setOnlineOverride(true);
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: DATE, time: TIME, iso: ISO });
});
afterAll(() => {
  setClock();
  setOnlineOverride(null);
});

describe('aprobar y emitir (RN-APR-01..06)', () => {
  it('aprueba una pendiente: ficha confirmada, slot/número/hora, historial con usuario', async () => {
    const s = ds.list('solicitudes').find((x) => x.codigo === 'CSC-PND2A4');
    const f = await requestAdminService.approve(RECEP, s.id);
    expect(f).toMatchObject({ estado: 'confirmada', canal: 'web', solicitudId: s.id });
    expect(f.codigoVisible).toMatch(/^PED-\d{2}$/);
    const s2 = ds.get('solicitudes', s.id);
    expect(s2).toMatchObject({ estado: 'aprobada', fichaId: f.id });
    expect(s2.historial.at(-1)).toMatchObject({ estado: 'aprobada', usuarioId: 'usr_003' });
    expect(s2.historial.at(-1).nota).toContain(f.codigoVisible);
    expect(integrity()).toEqual([]);
  });

  it('con 1 cupo web libre, dos aprobaciones: solo una emite, la otra CUPO_AGOTADO', async () => {
    // Bloque futuro con ≥ 2 cupos web libres.
    let h;
    let fecha;
    for (let d = 1; d <= 7 && !h; d++) {
      fecha = addDays(DATE, d);
      h = all().horarios.find(
        (x) =>
          x.centroId === 'cen_001' &&
          x.activo &&
          x.diaSemana === isoWeekday(fecha) &&
          block(x.id, fecha).publicosLibres >= 2 &&
          !block(x.id, fecha).bloqueado,
      );
    }
    expect(h).toBeTruthy();
    const extra = await pendings(block(h.id, fecha).publicosLibres - 1, h.especialidadId, fecha);
    for (const e of extra) await requestAdminService.approve(RECEP, e.id, { horarioId: h.id });
    expect(block(h.id, fecha).publicosLibres).toBe(1);
    const [a, b] = await pendings(2, h.especialidadId, fecha);
    // "Dos pestañas": ambas se lanzan a la vez; la transacción síncrona serializa.
    const res = await Promise.allSettled([
      requestAdminService.approve(RECEP, a.id, { horarioId: h.id }),
      requestAdminService.approve(RECEP, b.id, { horarioId: h.id }),
    ]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(res.find((r) => r.status === 'rejected').reason.code).toBe('CUPO_AGOTADO');
    expect(block(h.id, fecha).publicosLibres).toBe(0);
    expect(integrity()).toEqual([]);
  });

  it('ventanilla usa cupos no públicos; web no', async () => {
    // Bloque de hoy con cupos de ventanilla reservados y cupos web libres.
    const h = all().horarios.find(
      (x) =>
        x.centroId === 'cen_001' &&
        x.activo &&
        x.diaSemana === 1 &&
        block(x.id, DATE).libres > block(x.id, DATE).publicosLibres &&
        block(x.id, DATE).publicosLibres > 0,
    );
    expect(h).toBeTruthy();
    const web = await pendings(block(h.id, DATE).publicosLibres + 1, h.especialidadId, DATE);
    for (const w of web.slice(0, -1)) await requestAdminService.approve(RECEP, w.id, { horarioId: h.id });
    const blk = block(h.id, DATE);
    expect(blk.publicosLibres).toBe(0);
    expect(blk.libres).toBeGreaterThan(0);
    await expect(
      requestAdminService.approve(RECEP, web.at(-1).id, { horarioId: h.id }),
    ).rejects.toMatchObject({ code: 'CUPO_AGOTADO' });
    const f = await appointmentService.issueWalkIn(RECEP, { paciente: persona('9990001'), horarioId: h.id });
    expect(f).toMatchObject({ canal: 'ventanilla', estado: 'en_espera', solicitudId: null, fecha: DATE });
    expect(integrity()).toEqual([]);
  });

  it('paciente bloqueado: no se aprueba ni se emite ventanilla', async () => {
    const jorge = ds.list('pacientes').find((p) => p.numeroDocumento === '5111032');
    const h = all().horarios.find(
      (x) => x.centroId === 'cen_001' && x.especialidadId === 'esp_001' && x.activo && x.diaSemana === 1,
    );
    await expect(
      appointmentService.issueWalkIn(RECEP, { paciente: persona(jorge.numeroDocumento), horarioId: h.id }),
    ).rejects.toMatchObject({ code: 'PACIENTE_BLOQUEADO' });
  });

  it('otro centro → ACCESO_DENEGADO; sin permiso → PERMISO_DENEGADO', async () => {
    const s = ds.list('solicitudes').find((x) => x.codigo === 'CSC-PND2A4');
    await expect(requestAdminService.approve(RECEP_POMPEYA, s.id)).rejects.toMatchObject({
      code: 'ACCESO_DENEGADO',
    });
    await expect(requestAdminService.approve(MEDICO, s.id)).rejects.toMatchObject({
      code: 'PERMISO_DENEGADO',
    });
  });
});

describe('rechazar, lista de espera, cancelar (RN-SOL-10/11)', () => {
  it('rechazar exige motivo y queda en historial', async () => {
    const s = ds.list('solicitudes').find((x) => x.codigo === 'CSC-G7N3B5');
    await expect(requestAdminService.reject(RECEP, s.id, {})).rejects.toMatchObject({ code: 'VALIDACION' });
    await expect(requestAdminService.reject(RECEP, s.id, { motivo: 'Otro' })).rejects.toMatchObject({
      code: 'VALIDACION',
    });
    const r = await requestAdminService.reject(RECEP, s.id, { motivo: 'Solicitud duplicada' });
    expect(r).toMatchObject({ estado: 'rechazada', motivoEstado: 'Solicitud duplicada' });
    await expect(
      requestAdminService.reject(RECEP, s.id, { motivo: 'Solicitud duplicada' }),
    ).rejects.toMatchObject({ code: 'TRANSICION_INVALIDA' });
  });

  it('lista de espera → aprobar luego', async () => {
    const s = ds.list('solicitudes').find((x) => x.codigo === 'CSC-G7N3B5');
    expect((await requestAdminService.moveToWaitlist(RECEP, s.id)).estado).toBe('lista_espera');
    expect((await requestAdminService.list(RECEP, { tab: 'lista_espera' })).some((r) => r.id === s.id)).toBe(
      true,
    );
  });

  it('cancelar una aprobada cancela la ficha, libera el cupo y avisa si hay lista de espera', async () => {
    const s = ds.list('solicitudes').find((x) => x.codigo === 'CSC-7K3F9Q');
    const f = ds.get('fichas', s.fichaId);
    const antes = block(f.horarioId, f.fecha).libres;
    // Poner una solicitud en lista de espera para esa fecha/especialidad.
    const [w] = await pendings(1, f.especialidadId, f.fecha);
    await requestAdminService.moveToWaitlist(RECEP, w.id);
    await requestAdminService.cancel(RECEP, s.id, { motivo: 'Solicitado por el paciente' });
    expect(ds.get('fichas', f.id).estado).toBe('cancelada');
    expect(block(f.horarioId, f.fecha).libres).toBe(antes + 1);
    expect(
      ds.list('notificaciones').some((n) => n.tipo === 'lista_espera' && n.mensaje.includes(f.codigoVisible)),
    ).toBe(true);
  });
});

describe('entrega, sala y llamado (RN-FIC-02..06)', () => {
  const hoyConfirmada = () =>
    all().fichas.find((f) => f.centroId === 'cen_001' && f.fecha === DATE && f.estado === 'confirmada');

  it('llegada → llamar siguiente (preferente primero) → iniciar → atendida', async () => {
    const f = hoyConfirmada();
    const otra = all().fichas.find(
      (x) =>
        x.centroId === 'cen_001' &&
        x.fecha === DATE &&
        x.estado === 'confirmada' &&
        x.consultorioId === f.consultorioId &&
        x.id !== f.id,
    );
    await appointmentService.checkIn(RECEP, f.id, { verificar: true });
    if (otra) await appointmentService.checkIn(RECEP, otra.id, { prioridad: 'preferente' });
    // Liberar el consultorio si había alguien llamado / en atención.
    for (const x of all().fichas.filter(
      (y) =>
        y.centroId === 'cen_001' &&
        y.fecha === DATE &&
        y.consultorioId === f.consultorioId &&
        ['llamada', 'en_atencion'].includes(y.estado),
    )) {
      if (x.estado === 'llamada') await appointmentService.startAttention(RECEP, x.id);
      await appointmentService.finish(RECEP, x.id);
    }
    const queue = await appointmentService.getQueue(RECEP);
    const c = queue.find((q) => q.consultorioId === f.consultorioId);
    if (otra) expect(c.espera[0].prioridad).toBe('preferente');
    const called = await appointmentService.callNext(RECEP, f.consultorioId);
    expect(called.id).toBe(c.espera[0].id);
    await expect(appointmentService.callNext(RECEP, f.consultorioId)).rejects.toMatchObject({
      code: 'VALIDACION',
    });
    await appointmentService.repeatCall(RECEP, called.id);
    expect(ds.get('fichas', called.id).llamadas.length).toBeGreaterThanOrEqual(2);
    await appointmentService.startAttention(RECEP, called.id);
    const done = await appointmentService.finish(RECEP, called.id);
    expect(done.estado).toBe('atendida');
    expect(ds.get('pacientes', f.pacienteId).verificado).toBe(true);
  });

  it('ausente bloquea al paciente; revertir el mismo día lo desbloquea (RN-PAC-05/08)', async () => {
    const f = hoyConfirmada();
    await appointmentService.checkIn(RECEP, f.id);
    await appointmentService.markAbsent(RECEP, f.id);
    expect(ds.get('pacientes', f.pacienteId).bloqueo).toMatchObject({ activo: true, fichaId: f.id });
    await appointmentService.revertAbsence(RECEP, f.id);
    expect(ds.get('fichas', f.id).estado).toBe('en_espera');
    const p = ds.get('pacientes', f.pacienteId);
    expect(p.bloqueo.activo).toBe(false);
    expect(p.historialBloqueos.at(-1).accion).toBe('habilitacion');
  });

  it('médico solo opera sus fichas (RN-FIC-09)', async () => {
    const ajena = all().fichas.find(
      (f) =>
        f.centroId === 'cen_001' && f.fecha === DATE && f.medicoId !== 'med_001' && f.estado === 'confirmada',
    );
    await expect(appointmentService.markAbsent(MEDICO, ajena.id)).rejects.toMatchObject({
      code: 'ACCESO_DENEGADO',
    });
  });

  it('reprogramar libera el cupo original y vincula la nueva ficha (RN-FIC-08)', async () => {
    const s = ds.list('solicitudes').find((x) => x.codigo === 'CSC-7K3F9Q');
    const f = ds.get('fichas', s.fichaId);
    const destino = addDays(f.fecha, 1);
    const ops = appointmentService.rescheduleOptions(RECEP, f.id, destino).filter((b) => b.libres > 0);
    expect(ops.length).toBeGreaterThan(0);
    await expect(
      appointmentService.reschedule(RECEP, f.id, { fecha: destino, horarioId: ops[0].horarioId }),
    ).rejects.toMatchObject({ code: 'VALIDACION' });
    const nueva = await appointmentService.reschedule(RECEP, f.id, {
      fecha: destino,
      horarioId: ops[0].horarioId,
      motivo: 'Pedido del paciente',
    });
    expect(ds.get('fichas', f.id).estado).toBe('reprogramada');
    expect(nueva).toMatchObject({ estado: 'confirmada', fichaOrigenId: f.id, fecha: destino });
    expect(ds.get('solicitudes', s.id)).toMatchObject({ fichaId: nueva.id, fechaSolicitada: destino });
    expect(integrity()).toEqual([]);
  });

  it('cierre de jornada: pendientes → ausente con bloqueo; en atención → atendida', async () => {
    const r = await appointmentService.closeDay(RECEP);
    expect(r.ausentes).toBeGreaterThan(0);
    expect(
      all().fichas.filter(
        (f) =>
          f.centroId === 'cen_001' &&
          f.fecha === DATE &&
          ['confirmada', 'en_espera', 'llamada', 'en_atencion'].includes(f.estado),
      ),
    ).toEqual([]);
    expect(integrity()).toEqual([]);
  });
});

describe('propiedad: nunca se repite (horarioId, fecha, slot)', () => {
  it('300 operaciones aleatorias mantienen la integridad', { timeout: 120000 }, async () => {
    const rnd = createRandom(4242);
    const fechas = [DATE, addDays(DATE, 1), addDays(DATE, 2), addDays(DATE, 3)];
    const hs = all().horarios.filter((h) => h.centroId === 'cen_001' && h.activo);
    let doc = 8800000;
    for (let i = 0; i < 300; i++) {
      const op = rnd.int(0, 5);
      try {
        if (op === 0) {
          const fecha = rnd.pick(fechas);
          const esp = rnd.pick(['esp_001', 'esp_002', 'esp_004']);
          if (rnd.chance(0.5))
            await requestService.createRequest({
              centroId: 'cen_001',
              especialidadId: esp,
              fecha,
              paciente: { ...persona(String(doc++)), acepta: true },
            });
          else await pendings(1, esp, fecha);
        } else if (op === 1) {
          const p = all().solicitudes.filter(
            (s) => s.centroId === 'cen_001' && ['pendiente', 'lista_espera'].includes(s.estado),
          );
          if (p.length) {
            const s = rnd.pick(p);
            const h = rnd.chance(0.5)
              ? rnd.pick(hs.filter((x) => x.especialidadId === s.especialidadId))
              : null;
            await requestAdminService.approve(RECEP, s.id, h ? { horarioId: h.id } : {});
          }
        } else if (op === 2) {
          const h = rnd.pick(hs.filter((x) => x.diaSemana === 1));
          await appointmentService.issueWalkIn(RECEP, { paciente: persona(String(doc++)), horarioId: h.id });
        } else if (op === 3) {
          const f = all().fichas.filter(
            (x) =>
              x.centroId === 'cen_001' && ['confirmada', 'en_espera'].includes(x.estado) && x.fecha >= DATE,
          );
          if (f.length)
            await appointmentService.cancel(RECEP, rnd.pick(f).id, { motivo: 'Error de registro' });
        } else if (op === 4) {
          const f = all().fichas.filter(
            (x) => x.centroId === 'cen_001' && x.estado === 'confirmada' && x.fecha >= DATE,
          );
          if (f.length) {
            const x = rnd.pick(f);
            const fecha = rnd.pick(fechas);
            const ops = appointmentService.rescheduleOptions(RECEP, x.id, fecha);
            if (ops.length)
              await appointmentService.reschedule(RECEP, x.id, {
                fecha,
                horarioId: rnd.pick(ops).horarioId,
                motivo: 'Prueba',
              });
          }
        } else {
          const f = all().fichas.filter(
            (x) => x.centroId === 'cen_001' && x.fecha === DATE && x.estado === 'confirmada',
          );
          if (f.length) await appointmentService.checkIn(RECEP, rnd.pick(f).id);
        }
      } catch (e) {
        if (!e.code) throw e; // errores de negocio esperables (cupo agotado, duplicado…)
      }
    }
    expect(integrity()).toEqual([]);
  });
});
