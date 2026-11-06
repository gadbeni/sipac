/**
 * Generador de actividad de demostración (DATA_MODEL §6).
 *
 * 1. Coloca los escenarios fijos (fichas.json / solicitudes.json) en fechas reales con horario,
 *    ajustando al día hábil más cercano.
 * 2. Genera volumen histórico y futuro coherente: recorre los bloques reales de agenda,
 *    respeta cupos, cupos públicos, excepciones, duplicados por paciente y el bloqueo por
 *    inasistencia (D-22).
 *
 * Es determinista para una misma semilla y la misma fecha de referencia.
 */
import { CANALES, MOTIVOS_CANCELACION, MOTIVOS_RECHAZO } from '@/config/constants';
import { createRandom } from '@/utils/random';
import {
  addDays,
  diffDays,
  toIso,
  addMinutesIso,
  addMinutesToTime,
  timeToMinutes,
  minutesToTime,
  ageAt,
} from '@/utils/dates';
import { generateRequestCode, formatTicketCode, documentKey } from '@/utils/codes';
import {
  computeBlock,
  getDayBlocks,
  nextFreeSlot,
  estimatedTime,
  blockKey,
  chooseBlock,
} from '../rules/availability';
import { blockPatient, unblockPatient } from '../rules/patientBlock';

const DAY_OF_STATES = new Set(['en_espera', 'llamada', 'en_atencion']);
const PAST_STATES = new Set(['atendida', 'ausente']);
const OCCUPYING = new Set(['confirmada', 'en_espera', 'llamada', 'en_atencion', 'atendida', 'ausente']);

const pad = (n, len) => String(n).padStart(len, '0');
const minIso = (a, b) => (a < b ? a : b);

/**
 * @param {object} data   colecciones ya resueltas (catálogos + escenarios)
 * @param {object} opts   { today, nowTime, nowIso, escenario }
 * @returns {object} data con pacientes, solicitudes y fichas completos
 */
export function generateActivity(data, { today, nowTime, nowIso, escenario }) {
  const rng = createRandom(escenario.semilla ^ hashDate(today));
  const nowMin = timeToMinutes(nowTime);

  const especialidades = new Map(data.especialidades.map((e) => [e.id, e]));
  const centros = new Map(data.centros.map((c) => [c.id, c]));
  const ceMap = new Map(data.centroEspecialidades.map((ce) => [`${ce.centroId}|${ce.especialidadId}`, ce]));
  const horarios = new Map(data.horarios.map((h) => [h.id, h]));
  const receptionist = Object.fromEntries(
    data.centros.map((c) => [
      c.id,
      data.usuarios.find((u) => u.rol === 'recepcionista' && u.centroId === c.id)?.id || 'usr_001',
    ]),
  );

  const fichas = [];
  const solicitudes = [];
  const pacientes = new Map(data.pacientes.map((p) => [p.id, { ...p }]));
  generatePatients(pacientes, escenario, rng, today);

  // ------------------------------------------------------------ Estado incremental
  const occupancy = new Map();
  const index = { occupancy, pending: new Map() };
  const numbers = new Map();
  const patientDay = new Set(); // pac|fecha  → un paciente, una ficha por día
  const patientKey = new Set(); // pac|centro|esp|fecha  (RN-SOL-02)
  const futureActive = new Map(); // pac → nº activos futuros (RN-SOL-03)
  const blocked = new Map(); // pac → fecha desde la que está bloqueado
  const codes = new Set(data.solicitudes.map((s) => s.codigo));
  let fichaSeq = 0;
  let solSeq = 0;

  const snapshot = { ...data, fichas, solicitudes };

  const occEntry = (horarioId, fecha) => {
    const k = blockKey(horarioId, fecha);
    let e = occupancy.get(k);
    if (!e) occupancy.set(k, (e = { ocupados: 0, ocupadosWeb: 0, slots: new Set() }));
    return e;
  };
  const block = (h, fecha) => {
    occEntry(h.id, fecha);
    return computeBlock(snapshot, h, fecha, index);
  };
  const dayBlocks = (params) => {
    const bs = getDayBlocks(snapshot, { ...params, index, requireCentroActivo: false });
    for (const b of bs) occEntry(b.horarioId, b.fecha);
    return getDayBlocks(snapshot, { ...params, index, requireCentroActivo: false });
  };
  const nextNumber = (f) => {
    const k = `${f.centroId}|${f.especialidadId}|${f.fecha}`;
    const n = (numbers.get(k) || 0) + 1;
    numbers.set(k, n);
    return n;
  };
  const markPatient = (pacienteId, f) => {
    patientDay.add(`${pacienteId}|${f.fecha}`);
    patientKey.add(`${pacienteId}|${f.centroId}|${f.especialidadId}|${f.fecha}`);
    if (f.fecha >= today) futureActive.set(pacienteId, (futureActive.get(pacienteId) || 0) + 1);
  };
  const registerAbsence = (f) => {
    const p = pacientes.get(f.pacienteId);
    if (!p || p.bloqueo?.activo) return;
    const at = toIso(f.fecha, addMinutesToTime(horarios.get(f.horarioId).horaFin, 30));
    let np = blockPatient(p, {
      fichaId: f.id,
      centroId: f.centroId,
      fecha: minIso(at, nowIso),
      usuarioId: 'sistema',
    });
    const recent = diffDays(f.fecha, today) <= escenario.diasBloqueoReciente;
    if (!recent && rng.chance(escenario.probabilidades.habilitacionBloqueoAntiguo)) {
      const unlockDate = addDays(f.fecha, rng.int(1, 3));
      np = unblockPatient(np, {
        fecha: minIso(toIso(unlockDate, `${pad(rng.int(8, 11), 2)}:${pad(rng.int(0, 59), 2)}`), nowIso),
        usuarioId: receptionist[f.centroId],
        nota: 'Habilitado tras justificar la inasistencia en ventanilla',
      });
    } else {
      blocked.set(p.id, f.fecha);
    }
    pacientes.set(p.id, np);
  };

  // ------------------------------------------------------------ Construcción de fichas
  function stampTimes(f, h, ctx = {}) {
    const est = f.horaEstimada;
    const call = toIso(f.fecha, addMinutesToTime(est, rng.int(0, 8)));
    const t = {
      llegadaEn: null,
      llamadaEn: null,
      inicioAtencionEn: null,
      finAtencionEn: null,
      canceladaEn: null,
      llamadas: [],
    };
    const user = receptionist[f.centroId];
    if (['en_espera', 'llamada', 'en_atencion', 'atendida'].includes(f.estado)) {
      const arrival = toIso(
        f.fecha,
        minutesToTime(Math.max(timeToMinutes(h.horaInicio) - 60, timeToMinutes(est) - rng.int(5, 50))),
      );
      t.llegadaEn = f.fecha === today ? minIso(arrival, addMinutesIso(nowIso, -rng.int(3, 20))) : arrival;
    }
    if (['llamada', 'en_atencion', 'atendida'].includes(f.estado)) {
      t.llamadaEn = f.fecha === today ? minIso(call, addMinutesIso(nowIso, -2)) : call;
      if (t.llamadaEn < t.llegadaEn) t.llamadaEn = addMinutesIso(t.llegadaEn, 1);
      t.llamadas = [{ fecha: t.llamadaEn, usuarioId: user }];
    }
    if (['en_atencion', 'atendida'].includes(f.estado))
      t.inicioAtencionEn = addMinutesIso(t.llamadaEn, rng.int(1, 3));
    if (f.estado === 'atendida')
      t.finAtencionEn = addMinutesIso(
        t.inicioAtencionEn,
        Math.max(5, h.duracionConsultaMin + rng.int(-6, 4)),
      );
    if (f.estado === 'cancelada' || f.estado === 'reprogramada') {
      t.canceladaEn = ctx.canceladaEn || minIso(addMinutesIso(f.emitidaEn, rng.int(60, 1800)), nowIso);
      if (t.canceladaEn < f.emitidaEn) t.canceladaEn = f.emitidaEn;
    }
    return t;
  }

  function buildFicha(base, b, slot) {
    const h = b.horario;
    const esp = especialidades.get(h.especialidadId);
    const f = {
      id: base.id,
      solicitudId: base.solicitudId ?? null,
      centroId: h.centroId,
      pacienteId: base.pacienteId,
      especialidadId: h.especialidadId,
      medicoId: h.medicoId,
      horarioId: h.id,
      consultorioId: h.consultorioId,
      fecha: b.fecha,
      numero: 0,
      codigoVisible: '',
      slot,
      horaEstimada: estimatedTime(h, slot),
      canal: base.canal,
      estado: base.estado,
      prioridad: base.prioridad || 'normal',
      fichaOrigenId: base.fichaOrigenId ?? null,
      emitidaEn: base.emitidaEn,
      emitidaPor: base.emitidaPor || receptionist[h.centroId],
      motivoEstado: base.motivoEstado ?? null,
    };
    f.numero = nextNumber(f);
    f.codigoVisible = formatTicketCode(esp.codigo, f.numero);
    if (!f.emitidaEn) f.emitidaEn = defaultEmission(f, h);
    Object.assign(f, stampTimes(f, h, base));
    f.creadoEn = f.emitidaEn;
    f.actualizadoEn =
      f.finAtencionEn || f.canceladaEn || f.inicioAtencionEn || f.llamadaEn || f.llegadaEn || f.emitidaEn;
    if (OCCUPYING.has(f.estado)) {
      const e = occEntry(h.id, b.fecha);
      e.ocupados++;
      if (f.canal === CANALES.web) e.ocupadosWeb++;
      e.slots.add(slot);
    }
    markPatient(f.pacienteId, f);
    fichas.push(f);
    if (f.estado === 'ausente') registerAbsence(f);
    return f;
  }

  function defaultEmission(f, h) {
    if (f.canal === CANALES.ventanilla && f.fecha <= today) {
      const t = toIso(
        f.fecha,
        minutesToTime(Math.max(6 * 60, timeToMinutes(h.horaInicio) - rng.int(10, 70))),
      );
      return minIso(t, addMinutesIso(nowIso, -rng.int(5, 60)));
    }
    const t = toIso(addDays(f.fecha, -rng.int(1, 4)), `${pad(rng.int(8, 18), 2)}:${pad(rng.int(0, 59), 2)}`);
    return minIso(t, addMinutesIso(nowIso, -rng.int(10, 600)));
  }

  function newSolicitudForFicha(f, extra = {}) {
    const creadoEn = addMinutesIso(f.emitidaEn, -rng.int(15, 240));
    const s = {
      id: `sol_g${pad(++solSeq, 6)}`,
      codigo: generateRequestCode(centros.get(f.centroId).codigoCorto, rng.next, codes),
      centroId: f.centroId,
      pacienteId: f.pacienteId,
      especialidadId: f.especialidadId,
      fechaSolicitada: f.fecha,
      medicoPreferidoId: rng.chance(0.3) ? f.medicoId : null,
      canal: CANALES.web,
      estado: 'aprobada',
      motivoEstado: null,
      fichaId: f.id,
      datosPorVerificar: false,
      historial: [
        { estado: 'pendiente', fecha: creadoEn, usuarioId: 'publico', nota: null },
        { estado: 'aprobada', fecha: f.emitidaEn, usuarioId: f.emitidaPor, nota: null },
      ],
      creadoPor: 'publico',
      creadoEn,
      actualizadoEn: f.emitidaEn,
      ...extra,
    };
    if (f.estado === 'cancelada') {
      s.estado = 'cancelada';
      s.motivoEstado = f.motivoEstado;
      s.historial.push({
        estado: 'cancelada',
        fecha: f.canceladaEn,
        usuarioId: f.emitidaPor,
        nota: f.motivoEstado,
      });
      s.actualizadoEn = f.canceladaEn;
    }
    codes.add(s.codigo);
    f.solicitudId = s.id;
    solicitudes.push(s);
    return s;
  }

  function newOpenSolicitud(centroId, especialidadId, fecha, pacienteId, estado, extra = {}) {
    const creadoEn = minIso(
      toIso(addDays(fecha, -rng.int(0, 3)), `${pad(rng.int(7, 21), 2)}:${pad(rng.int(0, 59), 2)}`),
      addMinutesIso(nowIso, -rng.int(5, 900)),
    );
    const s = {
      id: `sol_g${pad(++solSeq, 6)}`,
      codigo: generateRequestCode(centros.get(centroId).codigoCorto, rng.next, codes),
      centroId,
      pacienteId,
      especialidadId,
      fechaSolicitada: fecha,
      medicoPreferidoId: null,
      canal: CANALES.web,
      estado,
      motivoEstado: null,
      fichaId: null,
      datosPorVerificar: false,
      historial: [{ estado: 'pendiente', fecha: creadoEn, usuarioId: 'publico', nota: null }],
      creadoPor: 'publico',
      creadoEn,
      actualizadoEn: creadoEn,
      ...extra,
    };
    codes.add(s.codigo);
    patientKey.add(`${pacienteId}|${centroId}|${especialidadId}|${fecha}`);
    if (estado === 'pendiente' || estado === 'lista_espera') {
      futureActive.set(pacienteId, (futureActive.get(pacienteId) || 0) + 1);
      if (estado === 'pendiente') {
        const k = `${centroId}|${especialidadId}|${fecha}`;
        index.pending.set(k, (index.pending.get(k) || 0) + 1);
      }
    }
    solicitudes.push(s);
    return s;
  }

  // ------------------------------------------------------------ Selección de pacientes
  const scenarioIds = new Set(
    data.solicitudes.map((s) => s.pacienteId).concat(data.fichas.map((f) => f.pacienteId)),
  );
  const pool = [...pacientes.values()].filter((p) => !scenarioIds.has(p.id));
  const pools = {
    child: pool.filter((p) => ageAt(p.fechaNacimiento, today) <= 14),
    fertile: pool.filter(
      (p) => p.sexo === 'F' && ageAt(p.fechaNacimiento, today) >= 15 && ageAt(p.fechaNacimiento, today) <= 45,
    ),
    women: pool.filter((p) => p.sexo === 'F' && ageAt(p.fechaNacimiento, today) >= 15),
    adult: pool.filter((p) => ageAt(p.fechaNacimiento, today) >= 15),
    all: pool,
  };
  const poolFor = (espId) => {
    const code = especialidades.get(espId).codigo;
    if (code === 'PED') return pools.child;
    if (code === 'CPN') return pools.fertile;
    if (code === 'GIN') return pools.women;
    if (code === 'NUT' || code === 'PSI' || code === 'ODO' || code === 'ENF') return pools.all;
    return rng.chance(0.85) ? pools.adult : pools.all;
  };
  function pickPatient(centroId, espId, fecha) {
    const list = poolFor(espId);
    for (let attempt = 0; attempt < 40; attempt++) {
      const p = rng.pick(list);
      if (blocked.has(p.id)) continue;
      if (patientDay.has(`${p.id}|${fecha}`)) continue;
      if (patientKey.has(`${p.id}|${centroId}|${espId}|${fecha}`)) continue;
      if (fecha >= today && (futureActive.get(p.id) || 0) >= 3) continue;
      return p;
    }
    return null;
  }

  // ------------------------------------------------------------ 1. Escenarios fijos
  const scenarioSol = new Map(data.solicitudes.map((s) => [s.id, { ...s }]));
  const placeDate = (centroId, espId, fecha, { medicoId, needCapacity, canal }) => {
    const dir = fecha < today ? -1 : 1;
    for (let k = 0; k <= 21; k++) {
      const d = fecha === today ? addDays(today, k) : addDays(fecha, dir * k);
      const blocks = dayBlocks({ centroId, fecha: d, especialidadId: espId }).filter((b) => !b.bloqueado);
      if (!blocks.length) continue;
      if (!needCapacity) {
        const pref = medicoId ? blocks.filter((b) => b.medicoId === medicoId) : blocks;
        if (pref.length) return { fecha: d, block: pref[0] };
        continue;
      }
      const { block: b } = chooseBlock(blocks, { medicoPreferidoId: medicoId, canal });
      if (b) return { fecha: d, block: b };
    }
    return null;
  };

  for (const base of data.fichas) {
    const sol = base.solicitudId ? scenarioSol.get(base.solicitudId) : null;
    let estado = base.estado;
    const placed = placeDate(base.centroId, base.especialidadId, base.fecha, {
      medicoId: sol?.medicoPreferidoId || base.medicoId,
      needCapacity: OCCUPYING.has(estado),
      canal: base.canal,
    });
    if (!placed) continue;
    if (DAY_OF_STATES.has(estado) && placed.fecha !== today) estado = 'confirmada';
    if (PAST_STATES.has(estado) && placed.fecha >= today) estado = 'confirmada';
    const b = block(placed.block.horario, placed.fecha);
    const slot = OCCUPYING.has(estado) ? nextFreeSlot(b) : rng.int(1, b.horario.cupos);
    buildFicha({ ...base, estado }, b, slot);
    if (sol && sol.fichaId === base.id) sol.fechaSolicitada = placed.fecha;
  }
  // Reprogramaciones: la solicitud apunta a la ficha final; su fecha es la de la ficha final.
  for (const sol of scenarioSol.values()) {
    if (sol.fichaId) {
      const f = fichas.find((x) => x.id === sol.fichaId);
      if (f) sol.fechaSolicitada = f.fecha;
    } else {
      const placed = placeDate(sol.centroId, sol.especialidadId, sol.fechaSolicitada, {
        medicoId: sol.medicoPreferidoId,
        needCapacity: false,
      });
      if (placed) sol.fechaSolicitada = placed.fecha;
      patientKey.add(`${sol.pacienteId}|${sol.centroId}|${sol.especialidadId}|${sol.fechaSolicitada}`);
      if (sol.estado === 'pendiente') {
        const k = `${sol.centroId}|${sol.especialidadId}|${sol.fechaSolicitada}`;
        index.pending.set(k, (index.pending.get(k) || 0) + 1);
      }
    }
    solicitudes.push(sol);
  }

  // ------------------------------------------------------------ 2. Volumen
  const { probabilidades: pr } = escenario;
  const from = addDays(today, -escenario.diasHistorial);
  const to = addDays(today, escenario.diasFuturo);
  for (let fecha = from; fecha <= to; fecha = addDays(fecha, 1)) {
    const ahead = diffDays(today, fecha);
    for (const b0 of dayBlocks({ fecha })) {
      if (b0.bloqueado) continue;
      const centro = centros.get(b0.centroId);
      if (!centro.activo && fecha >= today) continue; // centro inactivo: solo historial (RN-CEN-03)
      const ce = ceMap.get(`${b0.centroId}|${b0.especialidadId}`);
      const occBase =
        ahead <= 0
          ? (escenario.ocupacionPasada[b0.especialidadId] ?? escenario.ocupacionPasada.default)
          : (escenario.ocupacionFutura[ahead] ?? 0);
      const factor = escenario.ocupacionCentroFactor[b0.centroId] ?? 1;
      const target = Math.round(
        b0.cuposEfectivos * Math.min(1, occBase * factor * (ahead <= 0 ? 0.85 + rng.next() * 0.3 : 1)),
      );
      let b = block(b0.horario, fecha);
      const blockEnd = timeToMinutes(b.horaFin);
      let current = false; // una sola ficha "en atención/llamada" por bloque hoy
      let guard = 0;

      for (let i = b.ocupados; i < target && guard++ < 200; i++) {
        b = block(b0.horario, fecha);
        if (b.libres <= 0) break;
        const wantsWeb = ce.aceptaSolicitudesPublicas && b.publicosLibres > 0 && rng.chance(pr.usarCuposWeb);
        const canal =
          wantsWeb || (fecha > today && ce.aceptaSolicitudesPublicas && b.publicosLibres > 0)
            ? CANALES.web
            : CANALES.ventanilla;
        const p = pickPatient(b.centroId, b.especialidadId, fecha);
        if (!p) break;
        const slot = nextFreeSlot(b);
        const est = timeToMinutes(estimatedTime(b.horario, slot));
        let estado;
        let motivoEstado = null;
        const r = rng.next();
        if (fecha < today) {
          if (r < pr.ausente) {
            estado = 'ausente';
            motivoEstado = 'No se presentó al llamado';
          } else if (r < pr.ausente + pr.cancelada) {
            estado = 'cancelada';
            motivoEstado = rng.pick(MOTIVOS_CANCELACION.slice(0, 3));
          } else estado = 'atendida';
        } else if (fecha === today) {
          if (est + b.horario.duracionConsultaMin <= nowMin)
            estado = r < pr.ausente / 2 ? 'ausente' : 'atendida';
          else if (est <= nowMin && nowMin < blockEnd && !current) {
            estado = rng.chance(0.5) ? 'en_atencion' : 'llamada';
            current = true;
          } else if (est - 60 <= nowMin && nowMin < blockEnd) estado = 'en_espera';
          else if (nowMin >= blockEnd) estado = 'ausente';
          else estado = 'confirmada';
          if (estado === 'ausente') motivoEstado = 'No se presentó al llamado';
        } else {
          estado = r < pr.cancelada / 2 ? 'cancelada' : 'confirmada';
          if (estado === 'cancelada') motivoEstado = 'Solicitado por el paciente';
        }
        const f = buildFicha(
          {
            id: `fic_g${pad(++fichaSeq, 6)}`,
            pacienteId: p.id,
            canal,
            estado,
            motivoEstado,
            prioridad: ageAt(p.fechaNacimiento, today) >= 60 && rng.chance(0.6) ? 'preferente' : 'normal',
          },
          b,
          slot,
        );
        if (canal === CANALES.web) newSolicitudForFicha(f);
        if (estado === 'cancelada') i--; // la cancelada libera el cupo: no cuenta para la ocupación objetivo
      }

      // Solicitudes abiertas y cerradas sin ficha
      if (ce.aceptaSolicitudesPublicas) {
        if (fecha >= today && centro.activo) {
          const n = rng.int(...escenario.pendientesFuturosPorBloque);
          for (let k = 0; k < n; k++) {
            const p = pickPatient(b.centroId, b.especialidadId, fecha);
            if (p) newOpenSolicitud(b.centroId, b.especialidadId, fecha, p.id, 'pendiente');
          }
          b = block(b0.horario, fecha);
          if (b.publicosLibres === 0 && rng.chance(0.5)) {
            const p = pickPatient(b.centroId, b.especialidadId, fecha);
            if (p) {
              const s = newOpenSolicitud(b.centroId, b.especialidadId, fecha, p.id, 'lista_espera');
              s.historial.push({
                estado: 'lista_espera',
                fecha: minIso(addMinutesIso(s.creadoEn, 45), nowIso),
                usuarioId: receptionist[b.centroId],
                nota: 'Sin cupos en el bloque solicitado',
              });
              s.actualizadoEn = s.historial.at(-1).fecha;
            }
          }
        } else if (fecha < today) {
          if (rng.chance(pr.rechazadaPorBloque)) {
            const p = pickPatient(b.centroId, b.especialidadId, fecha);
            if (p) {
              const motivo = rng.pick(MOTIVOS_RECHAZO.slice(0, 3));
              const s = newOpenSolicitud(b.centroId, b.especialidadId, fecha, p.id, 'rechazada', {
                motivoEstado: motivo,
              });
              s.historial.push({
                estado: 'rechazada',
                fecha: addMinutesIso(s.creadoEn, rng.int(30, 300)),
                usuarioId: receptionist[b.centroId],
                nota: motivo,
              });
              s.actualizadoEn = s.historial.at(-1).fecha;
            }
          }
          if (rng.chance(pr.vencidaPorBloque)) {
            const p = pickPatient(b.centroId, b.especialidadId, fecha);
            if (p) {
              const s = newOpenSolicitud(b.centroId, b.especialidadId, fecha, p.id, 'vencida', {
                motivoEstado: 'Fecha de atención vencida sin asignación',
              });
              s.historial.push({
                estado: 'vencida',
                fecha: toIso(addDays(fecha, 1), '00:05'),
                usuarioId: 'sistema',
                nota: 'Vencimiento automático',
              });
              s.actualizadoEn = s.historial.at(-1).fecha;
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ 3. Coherencia de escenarios de lista de espera
  // Una solicitud en lista de espera debe corresponder a un día sin cupos públicos: se completa la demanda.
  for (const s of solicitudes) {
    if (s.estado !== 'lista_espera' || s.fechaSolicitada < today) continue;
    for (const b0 of dayBlocks({
      centroId: s.centroId,
      fecha: s.fechaSolicitada,
      especialidadId: s.especialidadId,
    })) {
      let b = block(b0.horario, s.fechaSolicitada);
      while (!b.bloqueado && b.publicosLibres > 0) {
        const p = pickPatient(b.centroId, b.especialidadId, b.fecha);
        if (!p) break;
        const f = buildFicha(
          { id: `fic_g${pad(++fichaSeq, 6)}`, pacienteId: p.id, canal: CANALES.web, estado: 'confirmada' },
          b,
          nextFreeSlot(b),
        );
        newSolicitudForFicha(f);
        b = block(b0.horario, s.fechaSolicitada);
      }
    }
  }

  fichas.sort((a, b) => (a.fecha + a.horaEstimada < b.fecha + b.horaEstimada ? -1 : 1));
  solicitudes.sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1));
  return { ...data, pacientes: [...pacientes.values()], solicitudes, fichas };
}

// ------------------------------------------------------------ Pacientes sintéticos
function generatePatients(map, escenario, rng, today) {
  const docs = new Set([...map.values()].map(documentKey));
  const year = Number(today.slice(0, 4));
  for (let i = 1; i <= escenario.pacientesGenerados; i++) {
    const r = rng.next();
    const age = r < 0.26 ? rng.int(0, 14) : r < 0.88 ? rng.int(15, 59) : rng.int(60, 88);
    const sexo = rng.chance(0.54) ? 'F' : 'M';
    const nombres = rng.pick(sexo === 'F' ? escenario.nombresF : escenario.nombresM);
    const apellidos = `${rng.pick(escenario.apellidos)} ${rng.pick(escenario.apellidos)}`;
    const fechaNacimiento = `${year - age - 1}-${pad(rng.int(1, 12), 2)}-${pad(rng.int(1, 28), 2)}`;
    const tipoDocumento = age < 5 && rng.chance(0.5) ? 'CERTIFICADO_NACIMIENTO' : 'CI';
    let numeroDocumento;
    do numeroDocumento = String(rng.int(3000000, 14999999));
    while (docs.has(documentKey({ tipoDocumento, numeroDocumento })));
    docs.add(documentKey({ tipoDocumento, numeroDocumento }));
    const id = `pac_g${pad(i, 4)}`;
    map.set(id, {
      id,
      tipoDocumento,
      numeroDocumento,
      complemento: null,
      nombres,
      apellidos,
      fechaNacimiento,
      sexo,
      telefono: `+591 7${rng.int(0, 9)}${pad(rng.int(0, 999999), 6)}`,
      verificado: rng.chance(0.6),
      bloqueo: { activo: false, motivo: null, fichaId: null, centroId: null, desde: null },
      historialBloqueos: [],
      origen: 'generado',
      creadoEn: '2026-03-01T09:00:00-04:00',
      actualizadoEn: '2026-03-01T09:00:00-04:00',
    });
  }
}

function hashDate(d) {
  let h = 0;
  for (const ch of d) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h >>> 0;
}
