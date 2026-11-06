/**
 * Solicitudes del portal ciudadano (BUSINESS_RULES §6, RN-SOL-01..14, RN-PAC-04..06).
 * Toda escritura ocurre en una transacción que relee los datos y revalida la disponibilidad:
 * lo que el asistente mostró pudo cambiar mientras el ciudadano completaba los pasos.
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { AppError } from './errors';
import { patientSchema, consultSchema } from './schemas/requestSchema';
import { PORTAL_COLLECTIONS, nowLocal } from './portalSnapshot';
import { getEnabledDates, getPublicAvailability } from './rules/availability';
import { isPatientBlocked } from './rules/patientBlock';
import { nextState, visibleStatus } from './rules/stateMachines';
import {
  citizenCancelInfo,
  countActiveRequests,
  doctorOptions,
  estimatedWindow,
  findDuplicate,
  findPatientByDocument,
  limitReached,
} from './rules/requests';
import { doctorName } from './rules/portal';
import { COLLECTIONS as C, ID_PREFIX } from '@/config/constants';
import { generateRequestCode, maskName } from '@/utils/codes';
import { nowIso } from '@/utils/dates';

const ds = () => getDataSource();
const PUBLICO = 'publico';
const WRITE = [C.solicitudes, C.pacientes, C.fichas, C.notificaciones];
const TX_COLLECTIONS = [...new Set([...PORTAL_COLLECTIONS, ...WRITE])];

const txSnapshot = (tx) => Object.fromEntries(TX_COLLECTIONS.map((c) => [c, tx.all(c)]));

const fieldErrors = (zerr) => Object.fromEntries(zerr.issues.map((i) => [i.path.join('.'), i.message]));

// ------------------------------------------------------------------ Intentos de consulta (RN-PAC-04)
const ATTEMPT_KEY = 'sipac:consultaIntentos';
const WINDOW_MS = 60_000;
const MAX_FAILS = 5;
const readFails = () => {
  try {
    return JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeFails = (arr) => {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(arr));
  } catch {
    /* sin sessionStorage */
  }
};
let memoryFails = [];
const fails = () => {
  const now = Date.now();
  const arr = (typeof sessionStorage === 'undefined' ? memoryFails : readFails()).filter(
    (t) => now - t < WINDOW_MS,
  );
  return arr;
};
const registerFail = () => {
  const arr = [...fails(), Date.now()];
  if (typeof sessionStorage === 'undefined') memoryFails = arr;
  else writeFails(arr);
};
export const _resetConsultAttempts = () => {
  memoryFails = [];
  writeFails([]);
};

// ------------------------------------------------------------------ Vista pública
/** Vista para comprobante y consulta: sin documento y con nombre enmascarado (RN-PAC-04). */
function publicView(snap, sol, now, iso) {
  const centro = snap.centros.find((c) => c.id === sol.centroId);
  const esp = snap.especialidades.find((e) => e.id === sol.especialidadId);
  const pac = snap.pacientes.find((p) => p.id === sol.pacienteId);
  const ficha = sol.fichaId ? snap.fichas.find((f) => f.id === sol.fichaId) : null;
  const estado = { ...sol };
  // RN-SOL-09: si la fecha ya pasó y nadie la procesó, se muestra como vencida (evaluación perezosa).
  if ((sol.estado === 'pendiente' || sol.estado === 'lista_espera') && sol.fechaSolicitada < now.date)
    estado.estado = 'vencida';
  const vis = visibleStatus(estado, ficha);
  const medicoId = ficha?.medicoId || sol.medicoPreferidoId;
  const medico = medicoId ? snap.medicos.find((m) => m.id === medicoId) : null;
  const consultorio = ficha ? snap.consultorios.find((c) => c.id === ficha.consultorioId) : null;
  const ventana = ficha
    ? null
    : estimatedWindow(snap, {
        centroId: sol.centroId,
        especialidadId: sol.especialidadId,
        fecha: sol.fechaSolicitada,
        medicoId: sol.medicoPreferidoId,
      });
  const cancel =
    estado.estado === 'vencida' ? { puede: false, hasta: null } : citizenCancelInfo(sol, ficha, iso);
  return {
    codigo: sol.codigo,
    estado: vis.key,
    estadoLabel: vis.label,
    motivo: sol.motivoEstado || ficha?.motivoEstado || null,
    centro: {
      nombre: centro.nombre,
      codigoCorto: centro.codigoCorto,
      direccion: centro.direccion,
      municipio: centro.municipio,
      telefono: centro.telefono,
    },
    especialidad: esp.nombre,
    paciente: maskName(pac.nombres, pac.apellidos),
    fecha: sol.fechaSolicitada,
    medico: medico ? doctorName(medico) : null,
    medicoAsignado: Boolean(ficha),
    ficha: ficha
      ? {
          codigo: ficha.codigoVisible,
          horaEstimada: ficha.horaEstimada,
          consultorio: consultorio?.nombre || null,
          reprogramada: Boolean(ficha.fichaOrigenId),
          fecha: ficha.fecha,
        }
      : null,
    ventana,
    creadoEn: sol.creadoEn,
    puedeCancelar: cancel.puede,
    cancelarHasta: cancel.hasta,
    datosPorVerificar: Boolean(sol.datosPorVerificar),
    esMenor:
      pac.tipoDocumento === 'CERTIFICADO_NACIMIENTO' ||
      (pac.fechaNacimiento &&
        pac.fechaNacimiento > `${Number(now.date.slice(0, 4)) - 18}${now.date.slice(4)}`),
  };
}

const samePatientData = (p, v) =>
  ['nombres', 'apellidos', 'fechaNacimiento'].every(
    (k) =>
      String(p[k] || '')
        .trim()
        .toLowerCase() ===
      String(v[k] || '')
        .trim()
        .toLowerCase(),
  ) && (p.telefono || '').replace(/\D/g, '') === (v.telefono || '').replace(/\D/g, '');

export const requestService = {
  // ------------------------------------------------------------------ Lecturas del asistente
  /** Fechas habilitadas (RN-DIS-01) con cupos por internet libres. */
  async getEnabledDates(centroId, especialidadId) {
    await delay();
    const snap = ds().snapshot(PORTAL_COLLECTIONS);
    return getEnabledDates(snap, { centroId, especialidadId, now: nowLocal() });
  },

  /** Profesionales elegibles en la fecha (con cupos por internet libres). */
  async getDoctorOptions(centroId, especialidadId, fecha) {
    await delay();
    const snap = ds().snapshot(PORTAL_COLLECTIONS);
    return doctorOptions(snap, { centroId, especialidadId, fecha, now: nowLocal() });
  },

  /** Franja informativa del día (para el resumen antes de confirmar). */
  getWindow(centroId, especialidadId, fecha, medicoId) {
    return estimatedWindow(ds().snapshot(PORTAL_COLLECTIONS), { centroId, especialidadId, fecha, medicoId });
  },

  // ------------------------------------------------------------------ Crear
  /**
   * Crea una solicitud `pendiente` (no consume cupo, RN-DIS-02).
   * @param {{ centroId, especialidadId, fecha, medicoPreferidoId?, paciente }} input
   * @returns {Promise<object>} vista pública (comprobante)
   */
  async createRequest(input) {
    await delay();
    const parsed = patientSchema.safeParse(input.paciente || {});
    if (!parsed.success) throw new AppError('VALIDACION', undefined, { fields: fieldErrors(parsed.error) });
    const p = parsed.data;
    const now = nowLocal();
    const iso = nowIso();

    return ds().transaction(TX_COLLECTIONS, (tx) => {
      const snap = txSnapshot(tx);
      const { centroId, especialidadId, fecha } = input;
      const medicoPreferidoId = input.medicoPreferidoId || null;

      // RN-SOL-01 + RN-DIS-01/03: revalidación de disponibilidad.
      const av = getPublicAvailability(snap, { centroId, especialidadId, fecha, now });
      if (!av.disponible) {
        const code =
          { CENTRO_INACTIVO: 'CENTRO_INACTIVO', DEMANDA_ALTA: 'DEMANDA_ALTA' }[av.motivo] ||
          'FECHA_NO_DISPONIBLE';
        throw new AppError(code, undefined, { motivo: av.motivo, volverA: 'fecha' });
      }
      const ce = snap.centroEspecialidades.find(
        (x) => x.centroId === centroId && x.especialidadId === especialidadId,
      );
      if (medicoPreferidoId) {
        if (ce.asignacionMedico === 'automatica')
          throw new AppError('VALIDACION', 'Esta especialidad no permite elegir profesional.');
        const ok = doctorOptions(snap, { centroId, especialidadId, fecha, now }).some(
          (d) => d.id === medicoPreferidoId,
        );
        if (!ok) throw new AppError('MEDICO_NO_DISPONIBLE', undefined, { volverA: 'medico' });
      }

      // RN-SOL-04: paciente por documento; no se sobrescriben datos existentes.
      let paciente = findPatientByDocument(snap.pacientes, p);
      let datosPorVerificar = false;
      if (paciente) {
        if (isPatientBlocked(paciente)) throw new AppError('PACIENTE_BLOQUEADO'); // RN-SOL-14 / RN-PAC-06
        datosPorVerificar = !samePatientData(paciente, p);
      }

      if (paciente) {
        if (findDuplicate(snap, { pacienteId: paciente.id, centroId, especialidadId, fecha }))
          throw new AppError('SOLICITUD_DUPLICADA'); // RN-SOL-02
        if (limitReached(countActiveRequests(snap, paciente.id, now.date)))
          throw new AppError('LIMITE_SOLICITUDES'); // RN-SOL-03
      } else {
        paciente = tx.insert(
          C.pacientes,
          {
            tipoDocumento: p.tipoDocumento,
            numeroDocumento: p.numeroDocumento,
            complemento: p.complemento ?? null,
            nombres: p.nombres,
            apellidos: p.apellidos,
            fechaNacimiento: p.fechaNacimiento,
            sexo: p.sexo,
            telefono: p.telefono,
            verificado: false,
            bloqueo: { activo: false, motivo: null, fichaId: null, centroId: null, desde: null },
            historialBloqueos: [],
            origen: 'web',
          },
          ID_PREFIX.pacientes,
        );
      }

      const centro = snap.centros.find((c) => c.id === centroId);
      const codigo = generateRequestCode(
        centro.codigoCorto,
        Math.random,
        new Set(snap.solicitudes.map((s) => s.codigo)),
      ); // RN-SOL-06
      const sol = tx.insert(
        C.solicitudes,
        {
          codigo,
          centroId,
          pacienteId: paciente.id,
          especialidadId,
          fechaSolicitada: fecha,
          medicoPreferidoId,
          canal: 'web',
          estado: 'pendiente',
          motivoEstado: null,
          fichaId: null,
          datosPorVerificar,
          // RN-SOL-04: lo ingresado se guarda aparte para que recepción lo compare; el registro no se toca.
          datosIngresados: datosPorVerificar
            ? {
                nombres: p.nombres,
                apellidos: p.apellidos,
                fechaNacimiento: p.fechaNacimiento,
                telefono: p.telefono,
              }
            : null,
          historial: [
            {
              estado: 'pendiente',
              fecha: iso,
              usuarioId: PUBLICO,
              nota: datosPorVerificar ? 'Datos del paciente por verificar' : null,
            },
          ],
          creadoPor: PUBLICO,
        },
        ID_PREFIX.solicitudes,
      );
      const esp = snap.especialidades.find((e) => e.id === especialidadId);
      tx.insert(
        C.notificaciones,
        {
          centroId,
          destinoUsuarioId: null,
          destinoRoles: ['admin_centro', 'recepcionista'],
          tipo: 'solicitud_nueva',
          titulo: 'Nueva solicitud web',
          mensaje: `${codigo}: ${esp.nombre} para el ${fecha.split('-').reverse().join('/')}.`,
          enlace: `/admin/solicitudes?codigo=${codigo}`,
          leidaPor: [],
        },
        ID_PREFIX.notificaciones,
      );
      return publicView(
        { ...snap, solicitudes: [...snap.solicitudes, sol], pacientes: tx.all(C.pacientes) },
        sol,
        now,
        iso,
      );
    });
  },

  // ------------------------------------------------------------------ Consulta pública
  /** Código + documento coincidentes; si no, mensaje genérico (RN-PAC-04). */
  async getPublicStatus(values) {
    if (fails().length >= MAX_FAILS) throw new AppError('DEMASIADOS_INTENTOS');
    await delay();
    const parsed = consultSchema.safeParse(values);
    if (!parsed.success) throw new AppError('VALIDACION', undefined, { fields: fieldErrors(parsed.error) });
    const { codigo, numeroDocumento } = parsed.data;
    const snap = ds().snapshot(TX_COLLECTIONS);
    const sol = snap.solicitudes.find((s) => s.codigo === codigo);
    const pac = sol && snap.pacientes.find((p) => p.id === sol.pacienteId);
    if (!sol || !pac || String(pac.numeroDocumento).toUpperCase() !== numeroDocumento) {
      registerFail();
      throw new AppError('SOLICITUD_NO_ENCONTRADA');
    }
    return publicView(snap, sol, nowLocal(), nowIso());
  },

  /** Cancelación por el ciudadano (RN-SOL-13): libera el cupo y no genera bloqueo. */
  async cancelByCitizen({ codigo, numeroDocumento, motivo = 'Solicitado por el paciente' }) {
    await delay();
    const now = nowLocal();
    const iso = nowIso();
    return ds().transaction(TX_COLLECTIONS, (tx) => {
      const k = String(codigo).trim().toUpperCase();
      const sol = tx.find(C.solicitudes, (s) => s.codigo === k);
      const pac = sol && tx.get(C.pacientes, sol.pacienteId);
      if (
        !sol ||
        !pac ||
        String(pac.numeroDocumento).toUpperCase() !== String(numeroDocumento).trim().toUpperCase()
      ) {
        throw new AppError('SOLICITUD_NO_ENCONTRADA');
      }
      const ficha = sol.fichaId ? tx.get(C.fichas, sol.fichaId) : null;
      const vencida =
        (sol.estado === 'pendiente' || sol.estado === 'lista_espera') && sol.fechaSolicitada < now.date;
      if (vencida || !citizenCancelInfo(sol, ficha, iso).puede)
        throw new AppError('CANCELACION_NO_PERMITIDA');

      const nota = `Cancelada por el ciudadano: ${motivo}`;
      if (ficha) {
        tx.update(C.fichas, ficha.id, {
          estado: nextState('ficha', ficha.estado, 'cancelar'),
          canceladaEn: iso,
          motivoEstado: motivo,
        });
        const esp = tx.get(C.especialidades, sol.especialidadId);
        const enEspera = tx.filter(
          C.solicitudes,
          (s) =>
            s.centroId === sol.centroId &&
            s.especialidadId === sol.especialidadId &&
            s.fechaSolicitada === ficha.fecha &&
            s.estado === 'lista_espera',
        ).length;
        tx.insert(
          C.notificaciones,
          {
            centroId: sol.centroId,
            destinoUsuarioId: null,
            destinoRoles: ['admin_centro', 'recepcionista'],
            tipo: 'cupo_liberado',
            titulo: 'Cupo liberado',
            mensaje: `Se canceló la ficha ${ficha.codigoVisible} (${esp.nombre}, ${ficha.fecha.split('-').reverse().join('/')}).${enEspera ? ` Hay ${enEspera} en lista de espera.` : ''}`,
            enlace: '/admin/solicitudes?tab=lista_espera',
            leidaPor: [],
          },
          ID_PREFIX.notificaciones,
        );
      }
      const upd = tx.update(C.solicitudes, sol.id, (s) => ({
        estado: nextState('solicitud', s.estado, 'cancelar'),
        motivoEstado: motivo,
        historial: [...s.historial, { estado: 'cancelada', fecha: iso, usuarioId: PUBLICO, nota }],
      }));
      return publicView(txSnapshot(tx), upd, now, iso);
    });
  },
};
