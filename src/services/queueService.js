/**
 * Pantalla de llamado (Épica 11, BUSINESS_RULES §7.2). Lectura pública, sin sesión:
 * nunca devuelve nombres ni documentos, solo el código visible de la ficha (RN-PAN-02).
 */
import { getDataSource } from './datasource';
import { delay } from './repositories/createRepository';
import { getDayBlocks } from './rules/availability';
import { doctorName } from './rules/portal';
import { queueOrder } from './appointmentService';
import { COLLECTIONS as C } from '@/config/constants';
import { currentTime, nowIso, timeToMinutes, today } from '@/utils/dates';

const ds = () => getDataSource();
const PROXIMOS = 3;
const ULTIMOS = 5;

/** Última vez que se llamó la ficha (llamado o repetición). */
const lastCall = (f) => f.llamadas?.at(-1)?.fecha || f.llamadaEn || null;

/** Solo lo que la sala puede ver. */
const publicTicket = (f, consultorio) => ({
  id: f.id,
  codigoVisible: f.codigoVisible,
  estado: f.estado,
  consultorio,
  llamadaEn: lastCall(f),
  llamadas: f.llamadas?.length || 0,
  preferente: f.prioridad === 'preferente',
});

export const queueService = {
  /**
   * Tablero del día de un centro, por código corto (CSC) o institucional (BEN-TRI-0001).
   * Devuelve `null` si el centro no existe o está inactivo.
   */
  async getBoard(codigoCentro) {
    await delay(0);
    const snap = ds().snapshot([
      C.centros,
      C.fichas,
      C.consultorios,
      C.medicos,
      C.especialidades,
      C.horarios,
      C.excepcionesAgenda,
      C.medicoCentros,
      C.centroEspecialidades,
    ]);
    const k = String(codigoCentro || '').toUpperCase();
    const centro = snap.centros.find((c) => c.codigoCorto === k || c.codigo === k);
    if (!centro || !centro.activo) return null;

    const fecha = today();
    const min = timeToMinutes(currentTime());
    const cons = new Map(snap.consultorios.map((x) => [x.id, x]));
    const med = new Map(snap.medicos.map((x) => [x.id, x]));
    const esp = new Map(snap.especialidades.map((x) => [x.id, x]));
    const fichas = snap.fichas.filter((f) => f.centroId === centro.id && f.fecha === fecha);
    const blocks = getDayBlocks(snap, { centroId: centro.id, fecha, incluirBloqueados: false });

    const ids = new Set([...blocks.map((b) => b.consultorioId), ...fichas.map((f) => f.consultorioId)]);
    const consultorios = [...ids]
      .filter(Boolean)
      .map((id) => {
        const nombre = cons.get(id)?.nombre || 'Consultorio';
        const del = fichas.filter((f) => f.consultorioId === id);
        const bs = blocks
          .filter((b) => b.consultorioId === id)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        // Bloque en curso; si no hay, el próximo del día; si terminaron, el último.
        const bloque =
          bs.find((b) => min >= timeToMinutes(b.horaInicio) && min < timeToMinutes(b.horaFin)) ||
          bs.find((b) => min < timeToMinutes(b.horaInicio)) ||
          bs.at(-1);
        const actual = del.find((f) => f.estado === 'llamada' || f.estado === 'en_atencion');
        const espera = del.filter((f) => f.estado === 'en_espera').sort(queueOrder);
        return {
          consultorioId: id,
          consultorio: nombre,
          especialidad: bloque
            ? esp.get(bloque.especialidadId)?.nombre
            : esp.get(del[0]?.especialidadId)?.nombre,
          medico: bloque ? doctorName(med.get(bloque.medicoId)) : null,
          horario: bloque ? `${bloque.horaInicio} – ${bloque.horaFin}` : null,
          actual: actual ? publicTicket(actual, nombre) : null,
          proximos: espera.slice(0, PROXIMOS).map((f) => publicTicket(f, nombre)),
          enEspera: espera.length,
        };
      })
      .sort((a, b) => a.consultorio.localeCompare(b.consultorio, 'es', { numeric: true }));

    const llamadas = fichas
      .filter((f) => lastCall(f))
      .map((f) => publicTicket(f, cons.get(f.consultorioId)?.nombre || 'Consultorio'))
      .sort((a, b) => b.llamadaEn.localeCompare(a.llamadaEn));
    // Se destaca el llamado más reciente cuya ficha sigue "llamada" (aún no entró al consultorio).
    const vigente = llamadas.find((t) => t.estado === 'llamada') || null;

    return {
      centro: { nombre: centro.nombre, codigoCorto: centro.codigoCorto },
      fecha,
      generadoEn: nowIso(),
      ultimoLlamado: vigente,
      // Clave del último evento de llamado: cambia con cada llamado o repetición (dispara aviso).
      eventoLlamado: llamadas[0] ? `${llamadas[0].id}#${llamadas[0].llamadas}` : null,
      ultimos: llamadas.filter((t) => t !== vigente).slice(0, ULTIMOS),
      consultorios,
      enEspera: consultorios.reduce((n, c) => n + c.enEspera, 0),
    };
  },
};
