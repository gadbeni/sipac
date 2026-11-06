/**
 * Cálculos del portal público (Épica 4) sobre el motor de disponibilidad.
 * Funciones puras: reciben un snapshot y `now = { date, time }`.
 *  - centerSpecialties: especialidades visibles (RN-ESP-02) con fichas disponibles (RN-DIS-01).
 *  - doctorsOnDuty: médicos con bloques efectivos en una fecha (horarios + excepciones).
 *  - centerSchedule: horario general, horario semanal por especialidad y cierres próximos.
 */
import { getDayBlocks, getEnabledDates, getPublicAvailability } from './availability';
import { closureFor, weeklyHours } from './centers';
import { addDays, timeToMinutes } from '@/utils/dates';
import { compareText } from '@/utils/text';

const byId = (arr) => new Map((arr || []).map((x) => [x.id, x]));
export const doctorName = (m) => `${m.nombres} ${m.apellidos}`;
export const initials = (m) => `${m.nombres[0] || ''}${m.apellidos[0] || ''}`.toUpperCase();

/** Horario vigente hoy o en el futuro, con médico y vínculo activos. */
function activeTemplates(snap, centroId, desde) {
  const meds = byId(snap.medicos);
  const mcs = byId(snap.medicoCentros);
  return (snap.horarios || []).filter((h) => {
    if (h.centroId !== centroId || !h.activo) return false;
    if (h.vigenciaHasta && h.vigenciaHasta < desde) return false;
    const m = meds.get(h.medicoId);
    const mc = mcs.get(h.medicoCentroId);
    return m?.activo && mc?.activo && (!mc.fechaFin || mc.fechaFin >= desde);
  });
}

/** Agrupa franjas iguales: [{ dias:[1,3], horaInicio, horaFin }]. */
function groupSlots(templates) {
  const groups = new Map();
  for (const h of templates) {
    const k = `${h.horaInicio}-${h.horaFin}`;
    if (!groups.has(k)) groups.set(k, { dias: [], horaInicio: h.horaInicio, horaFin: h.horaFin });
    const g = groups.get(k);
    if (!g.dias.includes(h.diaSemana)) g.dias.push(h.diaSemana);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, dias: g.dias.sort((a, b) => a - b) }))
    .sort((a, b) => a.dias[0] - b.dias[0] || timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
}

/**
 * Especialidades visibles en el portal del centro (RN-ESP-02): vínculo activo y al menos un
 * horario activo. Incluye fichas web disponibles hoy y la próxima fecha con cupos.
 */
export function centerSpecialties(snap, centroId, now) {
  const esps = byId(snap.especialidades);
  const meds = byId(snap.medicos);
  const templates = activeTemplates(snap, centroId, now.date);
  return (snap.centroEspecialidades || [])
    .filter((ce) => ce.centroId === centroId && ce.activo && esps.get(ce.especialidadId)?.activo)
    .map((ce) => {
      const e = esps.get(ce.especialidadId);
      const hs = templates.filter((h) => h.especialidadId === e.id);
      if (!hs.length) return null;
      const medicoIds = [...new Set(hs.map((h) => h.medicoId))];
      const hoy = getPublicAvailability(snap, { centroId, especialidadId: e.id, fecha: now.date, now });
      const proximas = ce.aceptaSolicitudesPublicas
        ? getEnabledDates(snap, { centroId, especialidadId: e.id, now })
        : [];
      return {
        id: e.id,
        codigo: e.codigo,
        nombre: e.nombre,
        icono: e.icono,
        descripcion: ce.descripcionLocal || e.descripcion,
        aceptaSolicitudesPublicas: ce.aceptaSolicitudesPublicas,
        asignacionMedico: ce.asignacionMedico,
        horarios: groupSlots(hs),
        medicos: medicoIds
          .map((id) => meds.get(id))
          .map((m) => ({ id: m.id, nombre: doctorName(m), iniciales: initials(m) }))
          .sort((a, b) => compareText(a.nombre, b.nombre)),
        hoy: {
          disponible: hoy.disponible,
          motivo: hoy.motivo,
          publicosLibres: hoy.disponible ? hoy.publicosLibres : 0,
        },
        proxima: proximas[0] || null,
        fechasDisponibles: proximas.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareText(a.nombre, b.nombre));
}

const RANK = { en_turno: 0, proximo: 1, programado: 2, finalizado: 3 };

/** Estado de un bloque respecto de "ahora". */
export function blockTiming(fecha, horaInicio, horaFin, now) {
  if (fecha > now.date) return 'programado';
  if (fecha < now.date) return 'finalizado';
  const m = timeToMinutes(now.time);
  if (m < timeToMinutes(horaInicio)) return 'proximo';
  if (m < timeToMinutes(horaFin)) return 'en_turno';
  return 'finalizado';
}

/**
 * Médicos de turno en (centro, fecha). Solo bloques efectivos: un permiso, ausencia,
 * feriado o bloqueo total quita al médico de la lista (CA Épica 4).
 */
export function doctorsOnDuty(snap, centroId, fecha, now) {
  const esps = byId(snap.especialidades);
  const meds = byId(snap.medicos);
  const cons = byId(snap.consultorios);
  const ces = new Map(
    (snap.centroEspecialidades || [])
      .filter((x) => x.centroId === centroId)
      .map((x) => [x.especialidadId, x]),
  );
  const blocks = getDayBlocks(snap, { centroId, fecha, incluirBloqueados: false });
  const byDoctor = new Map();
  for (const b of blocks) {
    if (b.cuposEfectivos <= 0) continue;
    const m = meds.get(b.medicoId);
    if (!byDoctor.has(m.id))
      byDoctor.set(m.id, {
        id: m.id,
        nombre: doctorName(m),
        iniciales: initials(m),
        especialidades: [],
        bloques: [],
      });
    const d = byDoctor.get(m.id);
    const esp = esps.get(b.especialidadId);
    if (!d.especialidades.includes(esp.nombre)) d.especialidades.push(esp.nombre);
    d.bloques.push({
      horarioId: b.horarioId,
      horaInicio: b.horaInicio,
      horaFin: b.horaFin,
      especialidadId: esp.id,
      especialidad: esp.nombre,
      consultorio: cons.get(b.consultorioId)?.nombre || null,
      estado: blockTiming(fecha, b.horaInicio, b.horaFin, now),
      aceptaWeb: Boolean(ces.get(esp.id)?.aceptaSolicitudesPublicas),
      cuposPublicos: b.cuposPublicosEfectivos,
      publicosLibres: b.publicosLibres,
      libres: b.libres,
    });
  }
  return [...byDoctor.values()]
    .map((d) => ({
      ...d,
      estado: d.bloques.reduce((best, b) => (RANK[b.estado] < RANK[best] ? b.estado : best), 'finalizado'),
    }))
    .sort(
      (a, b) =>
        RANK[a.estado] - RANK[b.estado] ||
        timeToMinutes(a.bloques[0].horaInicio) - timeToMinutes(b.bloques[0].horaInicio) ||
        compareText(a.nombre, b.nombre),
    );
}

/**
 * Horarios del centro: general por día, semanal por especialidad (con médicos) y cierres
 * (feriados/bloqueos totales) de los próximos `dias` días.
 */
export function centerSchedule(snap, centroId, now, { dias = 14 } = {}) {
  const center = (snap.centros || []).find((c) => c.id === centroId);
  if (!center) return null;
  const esps = byId(snap.especialidades);
  const meds = byId(snap.medicos);
  const ces = (snap.centroEspecialidades || []).filter((x) => x.centroId === centroId && x.activo);
  const templates = activeTemplates(snap, centroId, now.date);

  const especialidades = ces
    .map((ce) => {
      const e = esps.get(ce.especialidadId);
      const hs = templates.filter((h) => h.especialidadId === e.id);
      if (!hs.length || !e.activo) return null;
      const porDia = {};
      for (let d = 1; d <= 7; d++) {
        porDia[d] = hs
          .filter((h) => h.diaSemana === d)
          .sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio))
          .map((h) => ({
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
            medico: doctorName(meds.get(h.medicoId)),
          }));
      }
      return {
        id: e.id,
        nombre: e.nombre,
        icono: e.icono,
        aceptaSolicitudesPublicas: ce.aceptaSolicitudesPublicas,
        porDia,
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareText(a.nombre, b.nombre));

  const cierres = [];
  for (let i = 0; i <= dias; i++) {
    const fecha = addDays(now.date, i);
    const c = closureFor(center, fecha, snap.excepcionesAgenda);
    if (c) cierres.push({ fecha, motivo: c.motivo, tipo: c.tipo });
  }
  return { general: weeklyHours(center), especialidades, cierres };
}
