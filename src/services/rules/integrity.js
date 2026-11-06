/**
 * Validador de integridad referencial y de reglas de capacidad (DATA_MODEL §7).
 * Se ejecuta tras sembrar los datos y en las pruebas. Devuelve una lista de errores legibles.
 */
import { FICHA_OCUPA_CUPO, FICHA_ACTIVA } from '@/config/constants';
import { timeRangesOverlap, timeToMinutes } from '@/utils/dates';
import { documentKey, formatTicketCode } from '@/utils/codes';
import { computeBlock, buildOccupancyIndex, blockKey } from './availability';

const OCUPA = new Set(FICHA_OCUPA_CUPO);
const ACTIVA = new Set(FICHA_ACTIVA);

export function validateIntegrity(data, { maxErrors = 200 } = {}) {
  const errors = [];
  const err = (msg) => {
    if (errors.length < maxErrors) errors.push(msg);
  };
  const byId = {};
  for (const [c, arr] of Object.entries(data)) {
    const m = new Map();
    for (const it of arr || []) {
      if (!it.id) err(`${c}: registro sin id`);
      else if (m.has(it.id)) err(`${c}: id duplicado ${it.id}`);
      m.set(it.id, it);
    }
    byId[c] = m;
  }
  const has = (c, id) => byId[c]?.has(id);
  const get = (c, id) => byId[c]?.get(id);

  // Centros
  const codigos = new Set();
  const cortos = new Set();
  for (const c of data.centros || []) {
    if (codigos.has(c.codigo)) err(`centros: código duplicado ${c.codigo}`);
    if (cortos.has(c.codigoCorto)) err(`centros: código corto duplicado ${c.codigoCorto}`);
    codigos.add(c.codigo);
    cortos.add(c.codigoCorto);
  }

  for (const x of data.consultorios || [])
    if (!has('centros', x.centroId)) err(`consultorio ${x.id}: centro inexistente`);

  const cePairs = new Set();
  for (const ce of data.centroEspecialidades || []) {
    if (!has('centros', ce.centroId)) err(`centroEspecialidad ${ce.id}: centro inexistente`);
    if (!has('especialidades', ce.especialidadId))
      err(`centroEspecialidad ${ce.id}: especialidad inexistente`);
    const k = `${ce.centroId}|${ce.especialidadId}`;
    if (cePairs.has(k)) err(`centroEspecialidad duplicada ${k}`);
    cePairs.add(k);
  }

  // Médicos
  const docs = new Set();
  const regs = new Set();
  for (const m of data.medicos || []) {
    if (docs.has(m.numeroDocumento)) err(`médico ${m.id}: documento duplicado`);
    if (regs.has(m.registroProfesional)) err(`médico ${m.id}: registro profesional duplicado`);
    docs.add(m.numeroDocumento);
    regs.add(m.registroProfesional);
    for (const e of m.especialidadIds || [])
      if (!has('especialidades', e)) err(`médico ${m.id}: especialidad ${e} inexistente`);
  }

  const mcPairs = new Set();
  for (const mc of data.medicoCentros || []) {
    const med = get('medicos', mc.medicoId);
    if (!med) err(`medicoCentro ${mc.id}: médico inexistente`);
    if (!has('centros', mc.centroId)) err(`medicoCentro ${mc.id}: centro inexistente`);
    const k = `${mc.medicoId}|${mc.centroId}`;
    if (mcPairs.has(k)) err(`medicoCentro duplicado ${k}`);
    mcPairs.add(k);
    for (const e of mc.especialidadIds || []) {
      if (med && !med.especialidadIds.includes(e))
        err(`medicoCentro ${mc.id}: especialidad ${e} no habilitada para el médico`);
    }
  }

  // Horarios
  const horarios = data.horarios || [];
  for (const h of horarios) {
    const mc = get('medicoCentros', h.medicoCentroId);
    if (!mc) {
      err(`horario ${h.id}: medicoCentro inexistente`);
      continue;
    }
    if (mc.centroId !== h.centroId) err(`horario ${h.id}: centro distinto al del vínculo`);
    if (mc.medicoId !== h.medicoId) err(`horario ${h.id}: médico distinto al del vínculo`);
    if (!mc.especialidadIds.includes(h.especialidadId))
      err(`horario ${h.id}: especialidad no ejercida en el centro`);
    if (!cePairs.has(`${h.centroId}|${h.especialidadId}`))
      err(`horario ${h.id}: especialidad no ofrecida en el centro`);
    const con = get('consultorios', h.consultorioId);
    if (!con || con.centroId !== h.centroId) err(`horario ${h.id}: consultorio inexistente o de otro centro`);
    if (h.cuposPublicos > h.cupos) err(`horario ${h.id}: cuposPublicos > cupos`);
    if (h.cupos * h.duracionConsultaMin > timeToMinutes(h.horaFin) - timeToMinutes(h.horaInicio)) {
      err(`horario ${h.id}: los cupos no caben en la franja`);
    }
  }
  const vigenciasSolapan = (a, b) =>
    (!a.vigenciaHasta || !b.vigenciaDesde || a.vigenciaHasta >= b.vigenciaDesde) &&
    (!b.vigenciaHasta || !a.vigenciaDesde || b.vigenciaHasta >= a.vigenciaDesde);
  for (let i = 0; i < horarios.length; i++) {
    for (let j = i + 1; j < horarios.length; j++) {
      const a = horarios[i];
      const b = horarios[j];
      if (!a.activo || !b.activo || a.diaSemana !== b.diaSemana || !vigenciasSolapan(a, b)) continue;
      if (!timeRangesOverlap(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin)) continue;
      if (a.medicoId === b.medicoId)
        err(`horarios ${a.id}/${b.id}: médico con horarios solapados (RN-MC-05)`);
      if (a.consultorioId === b.consultorioId)
        err(`horarios ${a.id}/${b.id}: consultorio solapado (RN-HOR-03)`);
    }
  }

  // Pacientes
  const pdocs = new Set();
  for (const p of data.pacientes || []) {
    const k = documentKey(p);
    if (pdocs.has(k)) err(`paciente ${p.id}: documento duplicado`);
    pdocs.add(k);
    if (p.bloqueo?.activo && p.bloqueo.fichaId && !has('fichas', p.bloqueo.fichaId))
      err(`paciente ${p.id}: bloqueo con ficha inexistente`);
  }

  // Solicitudes
  const codes = new Set();
  for (const s of data.solicitudes || []) {
    if (codes.has(s.codigo)) err(`solicitud ${s.id}: código duplicado ${s.codigo}`);
    codes.add(s.codigo);
    if (!has('centros', s.centroId)) err(`solicitud ${s.id}: centro inexistente`);
    if (!has('pacientes', s.pacienteId)) err(`solicitud ${s.id}: paciente inexistente`);
    if (!cePairs.has(`${s.centroId}|${s.especialidadId}`))
      err(`solicitud ${s.id}: especialidad no ofrecida en el centro`);
    if (s.estado === 'aprobada' && !s.fichaId) err(`solicitud ${s.id}: aprobada sin ficha`);
    if (s.fichaId) {
      const f = get('fichas', s.fichaId);
      if (!f) err(`solicitud ${s.id}: ficha inexistente`);
      else {
        if (f.solicitudId !== s.id) err(`solicitud ${s.id}: vínculo con ficha no bidireccional`);
        if (f.centroId !== s.centroId) err(`solicitud ${s.id}: ficha de otro centro`);
      }
    }
  }

  // Fichas
  const slotKeys = new Set();
  const numKeys = new Set();
  const activeByPatient = new Set();
  for (const f of data.fichas || []) {
    const h = get('horarios', f.horarioId);
    if (!h) {
      err(`ficha ${f.id}: horario inexistente`);
      continue;
    }
    if (h.centroId !== f.centroId) err(`ficha ${f.id}: centro distinto al del horario`);
    if (h.medicoId !== f.medicoId) err(`ficha ${f.id}: médico distinto al del horario`);
    if (h.especialidadId !== f.especialidadId) err(`ficha ${f.id}: especialidad distinta a la del horario`);
    const con = get('consultorios', f.consultorioId);
    if (!con || con.centroId !== f.centroId) err(`ficha ${f.id}: consultorio inválido`);
    if (!has('pacientes', f.pacienteId)) err(`ficha ${f.id}: paciente inexistente`);
    if (f.solicitudId) {
      const s = get('solicitudes', f.solicitudId);
      if (!s) err(`ficha ${f.id}: solicitud inexistente`);
    }
    if (f.fichaOrigenId && !has('fichas', f.fichaOrigenId)) err(`ficha ${f.id}: ficha de origen inexistente`);
    const esp = get('especialidades', f.especialidadId);
    if (esp && f.codigoVisible !== formatTicketCode(esp.codigo, f.numero))
      err(`ficha ${f.id}: código visible inconsistente`);
    const nk = `${f.centroId}|${f.especialidadId}|${f.fecha}|${f.numero}`;
    if (numKeys.has(nk)) err(`ficha ${f.id}: número repetido ${nk}`);
    numKeys.add(nk);
    if (OCUPA.has(f.estado)) {
      const sk = `${f.horarioId}|${f.fecha}|${f.slot}`;
      if (slotKeys.has(sk)) err(`ficha ${f.id}: cupo duplicado ${sk} (RN-APR-04)`);
      slotKeys.add(sk);
    }
    if (ACTIVA.has(f.estado)) {
      const ak = `${f.pacienteId}|${f.centroId}|${f.especialidadId}|${f.fecha}`;
      if (activeByPatient.has(ak))
        err(`ficha ${f.id}: paciente con dos fichas activas el mismo día y especialidad (RN-SOL-02)`);
      activeByPatient.add(ak);
    }
  }

  // Capacidad por bloque (RN-APR-03)
  const occupancy = buildOccupancyIndex(data.fichas || []);
  const checked = new Set();
  for (const f of data.fichas || []) {
    if (!OCUPA.has(f.estado)) continue;
    const k = blockKey(f.horarioId, f.fecha);
    if (checked.has(k)) continue;
    checked.add(k);
    const h = get('horarios', f.horarioId);
    if (!h) continue;
    const b = computeBlock(data, h, f.fecha, { occupancy, pending: new Map() });
    // Las fichas emitidas antes de un bloqueo o ajuste se respetan (RN-HOR-05): se compara con la plantilla.
    const max = b.bloqueado ? h.cupos : Math.max(b.cuposEfectivos, 0);
    if (b.ocupados > max) err(`bloque ${k}: ${b.ocupados} fichas superan ${max} cupos`);
    const webMax = b.bloqueado ? h.cuposPublicos : b.cuposPublicosEfectivos;
    if (b.ocupadosWeb > webMax) {
      err(`bloque ${k}: ${b.ocupadosWeb} fichas web superan ${webMax} cupos públicos`);
    }
    for (const s of b.slotsOcupados) if (s < 1 || s > h.cupos) err(`bloque ${k}: slot ${s} fuera de rango`);
  }

  // Usuarios
  const users = new Set();
  for (const u of data.usuarios || []) {
    if (users.has(u.username)) err(`usuario ${u.id}: username duplicado`);
    users.add(u.username);
    if (u.rol !== 'admin_central' && u.rol !== 'medico' && !has('centros', u.centroId))
      err(`usuario ${u.id}: centro inexistente`);
    if (u.rol === 'medico' && !has('medicos', u.medicoId)) err(`usuario ${u.id}: médico inexistente`);
  }

  return errors;
}
