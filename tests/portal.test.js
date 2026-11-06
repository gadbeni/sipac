import { describe, expect, it } from 'vitest';
import { buildDemoData } from '@/services/seed/initDemoData';
import { blockTiming, centerSchedule, centerSpecialties, doctorsOnDuty } from '@/services/rules/portal';
import { getPublicAvailability } from '@/services/rules/availability';
import { addDays, isoWeekday, toIso } from '@/utils/dates';

// Lunes 09/11/2026 07:30 (antes de abrir los bloques de la mañana)
const now = { date: '2026-11-09', time: '07:30' };
const data = buildDemoData({ ...now, iso: toIso(now.date, now.time) });

describe('portal — especialidades', () => {
  const list = centerSpecialties(data, 'cen_001', now);

  it('muestra especialidades activas con horario; Psicología como solo ventanilla', () => {
    expect(list.length).toBeGreaterThanOrEqual(6);
    const psi = list.find((e) => e.codigo === 'PSI');
    expect(psi.aceptaSolicitudesPublicas).toBe(false);
    expect(psi.proxima).toBeNull();
    expect(list.every((e) => e.horarios.length > 0 && e.medicos.length > 0)).toBe(true);
  });

  it('las fichas disponibles de hoy coinciden con el motor de disponibilidad', () => {
    for (const e of list.filter((x) => x.aceptaSolicitudesPublicas)) {
      const a = getPublicAvailability(data, {
        centroId: 'cen_001',
        especialidadId: e.id,
        fecha: now.date,
        now,
      });
      expect(e.hoy.publicosLibres).toBe(a.disponible ? a.publicosLibres : 0);
    }
  });

  it('desactivar el vínculo oculta la especialidad (RN-ESP-02)', () => {
    const snap = {
      ...data,
      centroEspecialidades: data.centroEspecialidades.map((x) =>
        x.centroId === 'cen_001' && x.especialidadId === 'esp_002' ? { ...x, activo: false } : x,
      ),
    };
    expect(centerSpecialties(snap, 'cen_001', now).some((e) => e.codigo === 'PED')).toBe(false);
  });
});

describe('portal — médicos de turno', () => {
  it('estado del bloque según la hora', () => {
    expect(blockTiming(now.date, '08:00', '12:00', { date: now.date, time: '07:59' })).toBe('proximo');
    expect(blockTiming(now.date, '08:00', '12:00', { date: now.date, time: '08:00' })).toBe('en_turno');
    expect(blockTiming(now.date, '08:00', '12:00', { date: now.date, time: '12:00' })).toBe('finalizado');
    expect(blockTiming(addDays(now.date, 1), '08:00', '12:00', now)).toBe('programado');
  });

  it('un médico con permiso no aparece ese día (exc_006: med_003 @d+2..+3)', () => {
    const permiso = data.excepcionesAgenda.find((e) => e.id === 'exc_006');
    const fecha = permiso.fechaInicio;
    const tiene = data.horarios.some(
      (h) => h.medicoId === 'med_003' && h.activo && h.diaSemana === isoWeekday(fecha),
    );
    const dia = doctorsOnDuty(data, 'cen_001', fecha, now);
    expect(dia.some((d) => d.id === 'med_003')).toBe(false);
    if (tiene) {
      // Sin la excepción sí aparecería.
      const sin = { ...data, excepcionesAgenda: data.excepcionesAgenda.filter((e) => e.id !== 'exc_006') };
      const otro = doctorsOnDuty(sin, 'cen_001', fecha, now).some((d) => d.id === 'med_003');
      const otrosCentros = data.horarios
        .filter((h) => h.medicoId === 'med_003' && h.diaSemana === isoWeekday(fecha))
        .map((h) => h.centroId);
      expect(otro).toBe(otrosCentros.includes('cen_001'));
    }
  });

  it('feriado: nadie de turno', () => {
    expect(doctorsOnDuty(data, 'cen_001', '2026-11-18', now)).toEqual([]);
  });

  it('lista médicos de hoy con bloques y estados', () => {
    const temprano = { date: now.date, time: '06:30' };
    const hoy = doctorsOnDuty(data, 'cen_001', now.date, temprano);
    expect(hoy.length).toBeGreaterThan(0);
    expect(hoy.every((d) => d.estado === 'proximo' && d.bloques.every((b) => b.estado === 'proximo'))).toBe(
      true,
    );
    const mediodia = doctorsOnDuty(data, 'cen_001', now.date, { date: now.date, time: '10:00' });
    expect(mediodia[0].estado).toBe('en_turno'); // los que atienden ahora van primero
  });
});

describe('portal — horarios', () => {
  it('horario semanal por especialidad y cierres próximos', () => {
    const s = centerSchedule(data, 'cen_001', { date: '2026-11-05', time: '10:00' });
    expect(s.general).toHaveLength(7);
    expect(s.especialidades.find((e) => e.nombre === 'Medicina General').porDia[1].length).toBeGreaterThan(0);
    expect(s.cierres.map((c) => c.fecha)).toContain('2026-11-18');
  });
});
