/** Conjunto mínimo y controlado para probar reglas (independiente de la semilla). */
export function makeSnapshot(overrides = {}) {
  const base = {
    centros: [
      {
        id: 'c1',
        codigoCorto: 'AAA',
        activo: true,
        config: { diasAnticipacionMax: 7, cierreMismoDiaMin: 60, factorLimitePendientes: 2 },
      },
      { id: 'c2', codigoCorto: 'BBB', activo: true, config: {} },
    ],
    centroEspecialidades: [
      { id: 'ce1', centroId: 'c1', especialidadId: 'mg', aceptaSolicitudesPublicas: true, activo: true },
      { id: 'ce2', centroId: 'c1', especialidadId: 'psi', aceptaSolicitudesPublicas: false, activo: true },
      { id: 'ce3', centroId: 'c2', especialidadId: 'mg', aceptaSolicitudesPublicas: true, activo: true },
    ],
    medicos: [
      { id: 'm1', activo: true },
      { id: 'm2', activo: true },
    ],
    medicoCentros: [
      { id: 'mc1', medicoId: 'm1', centroId: 'c1', activo: true, fechaInicio: null, fechaFin: null },
      { id: 'mc2', medicoId: 'm2', centroId: 'c1', activo: true, fechaInicio: null, fechaFin: null },
      { id: 'mc3', medicoId: 'm1', centroId: 'c2', activo: true, fechaInicio: null, fechaFin: null },
    ],
    // 2026-11-09 es lunes (diaSemana 1)
    horarios: [
      h('h1', 'c1', 'mc1', 'm1', 'mg', 1, '08:00', '12:00', 4, 2),
      h('h2', 'c1', 'mc2', 'm2', 'mg', 1, '14:00', '18:00', 3, 3),
      h('h3', 'c1', 'mc2', 'm2', 'psi', 2, '08:00', '12:00', 3, 0),
      h('h4', 'c2', 'mc3', 'm1', 'mg', 2, '08:00', '12:00', 4, 2),
    ],
    excepcionesAgenda: [],
    fichas: [],
    solicitudes: [],
  };
  return { ...base, ...overrides };
}

export function h(
  id,
  centroId,
  medicoCentroId,
  medicoId,
  especialidadId,
  diaSemana,
  horaInicio,
  horaFin,
  cupos,
  cuposPublicos,
) {
  return {
    id,
    centroId,
    medicoCentroId,
    medicoId,
    especialidadId,
    consultorioId: `con_${id}`,
    diaSemana,
    horaInicio,
    horaFin,
    duracionConsultaMin: 20,
    cupos,
    cuposPublicos,
    vigenciaDesde: null,
    vigenciaHasta: null,
    activo: true,
  };
}

let n = 0;
export function ficha(horarioId, fecha, slot, estado = 'confirmada', canal = 'web', extra = {}) {
  return { id: `f${++n}`, horarioId, fecha, slot, estado, canal, ...extra };
}

export const MON = '2026-11-09';
export const TUE = '2026-11-10';
