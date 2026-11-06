/**
 * Reglas puras de agenda (BUSINESS_RULES §5): validación de horarios, fichas afectadas por una
 * excepción y datos para las vistas Día / Semana / Mes.
 */
import { FICHA_OCUPA_CUPO } from '@/config/constants';
import { addDays, dateRange, isoWeekday, timeRangesOverlap, timeToMinutes } from '@/utils/dates';
import { buildOccupancyIndex, computeBlock, exceptionApplies, getDayBlocks } from './availability';
import { closureFor, hoursForWeekday } from './centers';
import { doctorName } from './portal';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const OCUPA = new Set(FICHA_OCUPA_CUPO);
const PENDIENTES = new Set(['confirmada', 'en_espera', 'llamada']);
const BLOQUEANTES = new Set(['feriado', 'ausencia', 'permiso', 'bloqueo']);
const DIAS = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
};

const vigenciasSolapan = (a, b) =>
  (!a.vigenciaHasta || !b.vigenciaDesde || a.vigenciaHasta >= b.vigenciaDesde) &&
  (!b.vigenciaHasta || !a.vigenciaDesde || b.vigenciaHasta >= a.vigenciaDesde);

/** Fichas futuras (≥ hoy) que ocupan cupo en el horario. */
export const futureTickets = (snap, horarioId, today) =>
  snap.fichas.filter(
    (f) =>
      f.horarioId === horarioId &&
      f.fecha >= today &&
      OCUPA.has(f.estado) &&
      f.estado !== 'atendida' &&
      f.estado !== 'ausente',
  );

/**
 * Valida un horario nuevo o editado (RN-HOR-01..05, RN-MC-05, RN-MED-04).
 * @returns {{ fields: Record<string,string>, warnings: string[] }}
 */
export function validateSchedule(snap, h, { excludeId = null, today } = {}) {
  const fields = {};
  const warnings = [];
  const mc = snap.medicoCentros.find((x) => x.id === h.medicoCentroId);
  if (!mc || !mc.activo) fields.medicoCentroId = 'Seleccione un profesional vinculado y activo en el centro.';
  else {
    if (mc.centroId !== h.centroId) fields.medicoCentroId = 'El vínculo no corresponde a este centro.';
    if (!mc.especialidadIds.includes(h.especialidadId))
      fields.especialidadId = 'El profesional no ejerce esa especialidad en este centro (RN-MED-04).';
  }
  const ce = snap.centroEspecialidades.find(
    (x) => x.centroId === h.centroId && x.especialidadId === h.especialidadId,
  );
  if (!ce || !ce.activo)
    fields.especialidadId = fields.especialidadId || 'La especialidad no está activa en el centro.';
  const con = snap.consultorios.find((x) => x.id === h.consultorioId);
  if (!con || con.centroId !== h.centroId) fields.consultorioId = 'Seleccione un consultorio del centro.';
  if (!(h.diaSemana >= 1 && h.diaSemana <= 7)) fields.diaSemana = 'Seleccione el día.';
  if (!HHMM.test(h.horaInicio || '')) fields.horaInicio = 'Hora inválida.';
  if (!HHMM.test(h.horaFin || '')) fields.horaFin = 'Hora inválida.';
  const dur = Number(h.duracionConsultaMin);
  const cupos = Number(h.cupos);
  const pub = Number(h.cuposPublicos);
  if (!Number.isInteger(dur) || dur < 5 || dur > 120) fields.duracionConsultaMin = 'Entre 5 y 120 minutos.';
  if (!Number.isInteger(cupos) || cupos < 1 || cupos > 60) fields.cupos = 'Entre 1 y 60.';
  if (!Number.isInteger(pub) || pub < 0) fields.cuposPublicos = 'Número entero ≥ 0.';
  else if (pub > cupos) fields.cuposPublicos = 'No puede superar los cupos totales (RN-HOR-02).';
  if (h.vigenciaHasta && h.vigenciaDesde && h.vigenciaHasta < h.vigenciaDesde)
    fields.vigenciaHasta = 'Debe ser posterior al inicio.';
  if (!fields.horaInicio && !fields.horaFin) {
    const span = timeToMinutes(h.horaFin) - timeToMinutes(h.horaInicio);
    if (span <= 0) fields.horaFin = 'Debe ser posterior al inicio.';
    else if (!fields.cupos && !fields.duracionConsultaMin && cupos * dur > span)
      fields.cupos = `Los cupos no caben en la franja: ${cupos} × ${dur} min > ${span} min (RN-HOR-02).`;
  }
  if (Object.keys(fields).length) return { fields, warnings };

  // Solapamientos (RN-MC-05 entre centros, RN-HOR-03 consultorio).
  for (const o of snap.horarios) {
    if (o.id === excludeId || !o.activo || o.diaSemana !== h.diaSemana || !vigenciasSolapan(o, h)) continue;
    if (!timeRangesOverlap(o.horaInicio, o.horaFin, h.horaInicio, h.horaFin)) continue;
    if (o.medicoId === h.medicoId) {
      const centro = snap.centros.find((c) => c.id === o.centroId);
      fields.horaInicio = `Se superpone con otro horario del mismo profesional: ${DIAS[o.diaSemana]} ${o.horaInicio}–${o.horaFin} en ${centro?.nombre} (RN-MC-05).`;
    } else if (o.consultorioId === h.consultorioId) {
      const med = snap.medicos.find((m) => m.id === o.medicoId);
      fields.consultorioId = `El consultorio ya está ocupado ${DIAS[o.diaSemana]} ${o.horaInicio}–${o.horaFin} por ${med ? doctorName(med) : 'otro profesional'} (RN-HOR-03).`;
    }
  }
  if (Object.keys(fields).length) return { fields, warnings };

  const centro = snap.centros.find((c) => c.id === h.centroId);
  const gen = centro && hoursForWeekday(centro, h.diaSemana);
  if (!gen)
    warnings.push(
      `El centro no atiende los ${DIAS[h.diaSemana]} según su horario general (turno extendido).`,
    );
  else if (
    timeToMinutes(h.horaInicio) < timeToMinutes(gen.apertura) ||
    timeToMinutes(h.horaFin) > timeToMinutes(gen.cierre)
  ) {
    warnings.push(
      `La franja sale del horario general del centro (${gen.apertura}–${gen.cierre}) (RN-HOR-04).`,
    );
  }

  if (excludeId) {
    const prev = snap.horarios.find((x) => x.id === excludeId);
    const fut = futureTickets(snap, excludeId, today);
    if (fut.length) {
      const structural = [
        'diaSemana',
        'horaInicio',
        'consultorioId',
        'medicoCentroId',
        'especialidadId',
        'duracionConsultaMin',
      ].filter((k) => String(prev[k]) !== String(h[k]));
      if (structural.length) {
        fields.diaSemana = `Tiene ${fut.length} fichas futuras emitidas: no se puede cambiar el día, la hora de inicio, el consultorio, el profesional, la especialidad ni la duración. Cree un horario nuevo y desactive este cuando ya no tenga fichas (RN-HOR-05).`;
      } else {
        const porFecha = new Map();
        for (const f of fut) porFecha.set(f.fecha, (porFecha.get(f.fecha) || 0) + 1);
        const exceso = [...porFecha.entries()].filter(([, n]) => n > cupos);
        if (exceso.length)
          warnings.push(
            `En ${exceso.length} fecha(s) ya hay más fichas emitidas que los ${cupos} cupos nuevos; se respetarán las existentes (RN-HOR-05).`,
          );
        if (h.activo === false && prev.activo)
          warnings.push(
            `El horario tiene ${fut.length} fichas futuras: se respetarán, pero no se emitirán nuevas.`,
          );
        if (h.vigenciaHasta && fut.some((f) => f.fecha > h.vigenciaHasta))
          warnings.push('Hay fichas emitidas después del fin de vigencia: se respetarán.');
      }
    }
  }
  return { fields, warnings };
}

/**
 * Fichas pendientes de atención afectadas por una excepción (RN-AGE-02).
 * Bloqueantes: las de bloques que la excepción anula. `ajuste_cupos`: las que exceden el nuevo máximo.
 */
export function affectedByException(snap, exc, { today }) {
  const horarios = new Map(snap.horarios.map((h) => [h.id, h]));
  const desde = exc.fechaInicio < today ? today : exc.fechaInicio;
  const cand = snap.fichas.filter(
    (f) => PENDIENTES.has(f.estado) && f.fecha >= desde && f.fecha <= exc.fechaFin,
  );
  if (BLOQUEANTES.has(exc.tipo))
    return cand.filter(
      (f) => horarios.get(f.horarioId) && exceptionApplies(exc, horarios.get(f.horarioId), f.fecha),
    );
  if (exc.tipo === 'ajuste_cupos') {
    const out = [];
    const byBlock = new Map();
    for (const f of snap.fichas.filter(
      (x) => OCUPA.has(x.estado) && x.fecha >= desde && x.fecha <= exc.fechaFin,
    )) {
      const h = horarios.get(f.horarioId);
      if (!h || !exceptionApplies(exc, h, f.fecha)) continue;
      const k = `${f.horarioId}|${f.fecha}`;
      if (!byBlock.has(k)) byBlock.set(k, []);
      byBlock.get(k).push(f);
    }
    for (const list of byBlock.values()) {
      const sorted = list.sort((a, b) => a.slot - b.slot);
      out.push(...sorted.slice(Number(exc.cuposAjustados)).filter((f) => PENDIENTES.has(f.estado)));
    }
    return out;
  }
  return [];
}

/**
 * Agenda del rango para el centro: por fecha, bloques con ocupación y cierres.
 * `filter = { medicoId?, especialidadId? }`.
 */
export function buildAgenda(snap, { centroId, desde, hasta, medicoId, especialidadId }) {
  const center = snap.centros.find((c) => c.id === centroId);
  const occupancy = buildOccupancyIndex(snap.fichas);
  const meds = new Map(snap.medicos.map((m) => [m.id, m]));
  const esps = new Map(snap.especialidades.map((e) => [e.id, e]));
  const cons = new Map(snap.consultorios.map((c) => [c.id, c]));
  return dateRange(desde, hasta).map((fecha) => {
    const blocks = getDayBlocks(snap, {
      centroId,
      fecha,
      medicoId,
      especialidadId,
      index: { occupancy, pending: new Map() },
    }).map((b) => ({
      horarioId: b.horarioId,
      fecha,
      medicoId: b.medicoId,
      medico: meds.get(b.medicoId) ? doctorName(meds.get(b.medicoId)) : '—',
      especialidadId: b.especialidadId,
      especialidad: esps.get(b.especialidadId)?.nombre,
      codigoEsp: esps.get(b.especialidadId)?.codigo,
      consultorio: cons.get(b.consultorioId)?.nombre,
      horaInicio: b.horaInicio,
      horaFin: b.horaFin,
      cuposPlantilla: b.cuposPlantilla,
      cuposEfectivos: b.cuposEfectivos,
      cuposPublicosEfectivos: b.cuposPublicosEfectivos,
      ocupados: b.ocupados,
      libres: b.libres,
      publicosLibres: b.publicosLibres,
      bloqueado: b.bloqueado,
      motivoBloqueo: b.motivoBloqueo,
      ajustado: b.excepciones.some((e) => e.tipo === 'ajuste_cupos'),
    }));
    const cierre = center ? closureFor(center, fecha, snap.excepcionesAgenda) : null;
    return {
      fecha,
      diaSemana: isoWeekday(fecha),
      cierre: cierre ? { tipo: cierre.tipo, motivo: cierre.motivo } : null,
      bloques: blocks,
      totales: {
        efectivos: blocks.reduce((s, b) => s + b.cuposEfectivos, 0),
        ocupados: blocks.reduce(
          (s, b) => s + Math.min(b.ocupados, Math.max(b.cuposEfectivos, b.ocupados)),
          0,
        ),
        libres: blocks.reduce((s, b) => s + b.libres, 0),
        bloqueados: blocks.filter((b) => b.bloqueado).length,
      },
    };
  });
}

/** Lunes de la semana y primer/último día de la cuadrícula del mes (semanas de lunes a domingo). */
export const weekStart = (fecha) => addDays(fecha, 1 - isoWeekday(fecha));
export function monthGrid(fecha) {
  const first = `${fecha.slice(0, 7)}-01`;
  const start = weekStart(first);
  const nextMonth = addDays(first, 32).slice(0, 7);
  const last = addDays(`${nextMonth}-01`, -1);
  return { start, end: addDays(weekStart(last), 6), first, last };
}

/** Bloque recalculado (para pruebas y diálogos). */
export const blockOf = (snap, horarioId, fecha) => {
  const h = snap.horarios.find((x) => x.id === horarioId);
  return h
    ? computeBlock(snap, h, fecha, { occupancy: buildOccupancyIndex(snap.fichas), pending: new Map() })
    : null;
};
