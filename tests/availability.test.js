import { describe, it, expect } from 'vitest';
import {
  getDayBlocks,
  getPublicAvailability,
  getEnabledDates,
  chooseBlock,
  nextFreeSlot,
  estimatedTime,
  exceptionApplies,
} from '@/services/rules/availability';
import { makeSnapshot, ficha, MON, TUE } from './fixtures';

const NOW = { date: '2026-11-08', time: '10:00' }; // domingo

describe('bloques de agenda', () => {
  it('solo incluye horarios vigentes del día de la semana', () => {
    const s = makeSnapshot();
    expect(getDayBlocks(s, { centroId: 'c1', fecha: MON }).map((b) => b.horarioId)).toEqual(['h1', 'h2']);
    expect(getDayBlocks(s, { centroId: 'c1', fecha: TUE }).map((b) => b.horarioId)).toEqual(['h3']);
  });

  it('respeta la vigencia del horario y la del vínculo médico-centro', () => {
    const s = makeSnapshot();
    s.horarios[0].vigenciaHasta = '2026-11-01';
    s.medicoCentros[1].fechaInicio = '2026-12-01';
    expect(getDayBlocks(s, { centroId: 'c1', fecha: MON })).toEqual([]);
  });

  it('excluye médicos, vínculos, especialidades o centros inactivos', () => {
    const s = makeSnapshot();
    s.medicos[0].activo = false;
    expect(getDayBlocks(s, { centroId: 'c1', fecha: MON }).map((b) => b.horarioId)).toEqual(['h2']);
    s.centroEspecialidades[0].activo = false;
    expect(getDayBlocks(s, { centroId: 'c1', fecha: MON })).toEqual([]);
    const s2 = makeSnapshot();
    s2.centros[0].activo = false;
    expect(getDayBlocks(s2, { centroId: 'c1', fecha: MON })).toEqual([]);
    expect(getDayBlocks(s2, { centroId: 'c1', fecha: MON, requireCentroActivo: false })).toHaveLength(2);
  });

  it('desactivar el vínculo en un centro no afecta al médico en otro centro (RN-MED-03)', () => {
    const s = makeSnapshot();
    s.medicoCentros[0].activo = false; // m1 en c1
    expect(getDayBlocks(s, { centroId: 'c1', fecha: MON }).map((b) => b.medicoId)).toEqual(['m2']);
    expect(getDayBlocks(s, { centroId: 'c2', fecha: TUE }).map((b) => b.medicoId)).toEqual(['m1']);
  });

  it('las solicitudes pendientes no consumen cupo; las fichas sí (RN-DIS-02)', () => {
    const s = makeSnapshot({
      solicitudes: [{ estado: 'pendiente', centroId: 'c1', especialidadId: 'mg', fechaSolicitada: MON }],
      fichas: [
        ficha('h1', MON, 1),
        ficha('h1', MON, 2, 'cancelada'),
        ficha('h1', MON, 3, 'atendida', 'ventanilla'),
      ],
    });
    const [b] = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(b.ocupados).toBe(2);
    expect(b.libres).toBe(2);
    expect(b.ocupadosWeb).toBe(1);
    expect(b.publicosLibres).toBe(1);
  });

  it('los cupos públicos libres nunca superan los libres totales', () => {
    const s = makeSnapshot({
      fichas: [
        ficha('h1', MON, 1, 'confirmada', 'ventanilla'),
        ficha('h1', MON, 2, 'confirmada', 'ventanilla'),
        ficha('h1', MON, 3, 'confirmada', 'ventanilla'),
      ],
    });
    const [b] = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(b.libres).toBe(1);
    expect(b.publicosLibres).toBe(1);
  });
});

describe('excepciones de agenda (RN-AGE-01)', () => {
  const base = {
    fechaInicio: MON,
    fechaFin: MON,
    horaInicio: null,
    horaFin: null,
    centroId: null,
    medicoId: null,
    especialidadId: null,
    horarioId: null,
  };

  it('un feriado global anula todos los bloques de todos los centros', () => {
    const s = makeSnapshot({
      excepcionesAgenda: [{ ...base, id: 'e', tipo: 'feriado', alcance: 'global', fechaFin: TUE }],
    });
    for (const [c, d] of [
      ['c1', MON],
      ['c2', TUE],
    ]) {
      expect(
        getDayBlocks(s, { centroId: c, fecha: d }).every((b) => b.bloqueado && b.cuposEfectivos === 0),
      ).toBe(true);
    }
  });

  it('el permiso de un médico en un centro no afecta su agenda en otro (RN-MC-04)', () => {
    const exc = {
      ...base,
      id: 'e',
      tipo: 'permiso',
      alcance: 'medico',
      centroId: 'c1',
      medicoId: 'm1',
      fechaFin: TUE,
    };
    const s = makeSnapshot({ excepcionesAgenda: [exc] });
    expect(getDayBlocks(s, { centroId: 'c1', fecha: MON }).find((b) => b.medicoId === 'm1').bloqueado).toBe(
      true,
    );
    expect(getDayBlocks(s, { centroId: 'c2', fecha: TUE })[0].bloqueado).toBe(false);
    // Ausencia sin centro = global para el médico
    s.excepcionesAgenda = [{ ...exc, tipo: 'ausencia', centroId: null }];
    expect(getDayBlocks(s, { centroId: 'c2', fecha: TUE })[0].bloqueado).toBe(true);
  });

  it('un bloqueo parcial solo afecta los bloques que se solapan', () => {
    const exc = {
      ...base,
      id: 'e',
      tipo: 'bloqueo',
      alcance: 'centro',
      centroId: 'c1',
      horaInicio: '10:00',
      horaFin: '12:00',
    };
    const s = makeSnapshot({ excepcionesAgenda: [exc] });
    const blocks = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(blocks.map((b) => b.bloqueado)).toEqual([true, false]);
    expect(exceptionApplies(exc, s.horarios[1], MON)).toBe(false);
  });

  it('el ajuste de cupos cambia la capacidad y limita los públicos', () => {
    const s = makeSnapshot({
      excepcionesAgenda: [
        {
          ...base,
          id: 'e',
          tipo: 'ajuste_cupos',
          alcance: 'horario',
          centroId: 'c1',
          horarioId: 'h1',
          cuposAjustados: 1,
        },
      ],
    });
    const [b] = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(b.cuposEfectivos).toBe(1);
    expect(b.cuposPublicosEfectivos).toBe(1);
  });
});

describe('disponibilidad pública (RN-DIS-01, RN-DIS-03, RN-ESP-02)', () => {
  it('habilita fechas con cupos públicos y deshabilita las demás', () => {
    const s = makeSnapshot();
    const dates = getEnabledDates(s, { centroId: 'c1', especialidadId: 'mg', now: NOW });
    expect(dates.map((d) => d.fecha)).toEqual([MON]); // ventana de 7 días: 08/11 → 15/11
    expect(dates[0].publicosLibres).toBe(5);
  });

  it('rechaza fechas pasadas, fuera de ventana, sin horario y especialidades solo de ventanilla', () => {
    const s = makeSnapshot();
    const q = (fecha, especialidadId = 'mg') =>
      getPublicAvailability(s, { centroId: 'c1', especialidadId, fecha, now: NOW }).motivo;
    expect(q('2026-11-02')).toBe('FECHA_PASADA');
    expect(q('2026-11-16')).toBe('FUERA_DE_VENTANA');
    expect(q(TUE)).toBe('SIN_HORARIO');
    expect(q(TUE, 'psi')).toBe('SOLO_VENTANILLA');
  });

  it('rechaza centros inactivos', () => {
    const s = makeSnapshot();
    s.centros[0].activo = false;
    expect(
      getPublicAvailability(s, { centroId: 'c1', especialidadId: 'mg', fecha: MON, now: NOW }).motivo,
    ).toBe('CENTRO_INACTIVO');
  });

  it('el mismo día, solo cuenta bloques que empiezan después del cierre', () => {
    const s = makeSnapshot();
    const at = (time) =>
      getPublicAvailability(s, {
        centroId: 'c1',
        especialidadId: 'mg',
        fecha: MON,
        now: { date: MON, time },
      });
    expect(at('06:59').publicosLibres).toBe(5);
    expect(at('07:00').publicosLibres).toBe(3); // el bloque de 08:00 cerró (60 min antes)
    expect(at('13:00').motivo).toBe('CIERRE_MISMO_DIA');
  });

  it('sin cupos públicos → SIN_CUPOS; demasiadas pendientes → DEMANDA_ALTA', () => {
    const full = makeSnapshot({
      fichas: [
        ficha('h1', MON, 1),
        ficha('h1', MON, 2),
        ficha('h2', MON, 1),
        ficha('h2', MON, 2),
        ficha('h2', MON, 3),
      ],
    });
    expect(
      getPublicAvailability(full, { centroId: 'c1', especialidadId: 'mg', fecha: MON, now: NOW }).motivo,
    ).toBe('SIN_CUPOS');
    const pend = Array.from({ length: 10 }, () => ({
      estado: 'pendiente',
      centroId: 'c1',
      especialidadId: 'mg',
      fechaSolicitada: MON,
    }));
    const busy = makeSnapshot({ solicitudes: pend });
    expect(
      getPublicAvailability(busy, { centroId: 'c1', especialidadId: 'mg', fecha: MON, now: NOW }).motivo,
    ).toBe('DEMANDA_ALTA');
    busy.solicitudes = pend.slice(0, 9);
    expect(
      getPublicAvailability(busy, { centroId: 'c1', especialidadId: 'mg', fecha: MON, now: NOW }).disponible,
    ).toBe(true);
  });

  it('un feriado deshabilita el día', () => {
    const s = makeSnapshot({
      excepcionesAgenda: [{ id: 'e', tipo: 'feriado', alcance: 'global', fechaInicio: MON, fechaFin: MON }],
    });
    expect(
      getPublicAvailability(s, { centroId: 'c1', especialidadId: 'mg', fecha: MON, now: NOW }).motivo,
    ).toBe('BLOQUEADO');
  });
});

describe('asignación de cupo (RN-APR-02, RN-APR-04, RN-APR-06)', () => {
  it('asigna el menor slot libre y calcula la hora estimada', () => {
    const s = makeSnapshot({
      fichas: [ficha('h1', MON, 1), ficha('h1', MON, 2, 'cancelada'), ficha('h1', MON, 3)],
    });
    const [b] = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(nextFreeSlot(b)).toBe(2);
    expect(estimatedTime(b.horario, 2)).toBe('08:20');
  });

  it('elige el bloque con más cupos libres si no hay médico preferido', () => {
    const s = makeSnapshot({
      fichas: [
        ficha('h2', MON, 1, 'confirmada', 'ventanilla'),
        ficha('h2', MON, 2, 'confirmada', 'ventanilla'),
      ],
    });
    const blocks = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(chooseBlock(blocks, { canal: 'ventanilla' }).block.horarioId).toBe('h1');
    expect(chooseBlock(blocks, { canal: 'web' }).block.horarioId).toBe('h1');
  });

  it('respeta al médico preferido y avisa si no tiene cupo', () => {
    const s = makeSnapshot({ fichas: [ficha('h2', MON, 1), ficha('h2', MON, 2), ficha('h2', MON, 3)] });
    const blocks = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(chooseBlock(blocks, { medicoPreferidoId: 'm1' }).block.horarioId).toBe('h1');
    expect(chooseBlock(blocks, { medicoPreferidoId: 'm2' })).toEqual({
      block: null,
      reason: 'MEDICO_SIN_CUPO',
    });
  });

  it('ventanilla puede usar cupos no públicos; web no', () => {
    const s = makeSnapshot({
      fichas: [
        ficha('h1', MON, 1),
        ficha('h1', MON, 2),
        ficha('h2', MON, 1),
        ficha('h2', MON, 2),
        ficha('h2', MON, 3),
      ],
    });
    const blocks = getDayBlocks(s, { centroId: 'c1', fecha: MON });
    expect(chooseBlock(blocks, { canal: 'web' }).reason).toBe('SIN_CUPO');
    expect(chooseBlock(blocks, { canal: 'ventanilla' }).block.horarioId).toBe('h1');
  });
});
