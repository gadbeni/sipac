/**
 * Etiqueta, tono e icono de cada estado (BUSINESS_RULES §6–7). El estado nunca se comunica
 * solo por color: el chip siempre lleva texto e icono.
 */
import Schedule from '@mui/icons-material/Schedule';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import CheckCircle from '@mui/icons-material/CheckCircle';
import EventAvailable from '@mui/icons-material/EventAvailable';
import Chair from '@mui/icons-material/Chair';
import Campaign from '@mui/icons-material/Campaign';
import MedicalServices from '@mui/icons-material/MedicalServices';
import TaskAlt from '@mui/icons-material/TaskAlt';
import PersonOff from '@mui/icons-material/PersonOff';
import Cancel from '@mui/icons-material/Cancel';
import EventRepeat from '@mui/icons-material/EventRepeat';
import Block from '@mui/icons-material/Block';
import EventBusy from '@mui/icons-material/EventBusy';
import ToggleOn from '@mui/icons-material/ToggleOn';
import ToggleOff from '@mui/icons-material/ToggleOff';
import Lock from '@mui/icons-material/Lock';
import Accessible from '@mui/icons-material/Accessible';
import Language from '@mui/icons-material/Language';
import Storefront from '@mui/icons-material/Storefront';

export const STATUS_CONFIG = {
  // Solicitud
  pendiente: { label: 'Pendiente', tone: 'warning', Icon: Schedule },
  aprobada: { label: 'Aprobada', tone: 'success', Icon: CheckCircle },
  lista_espera: { label: 'En lista de espera', tone: 'warning', Icon: HourglassEmpty },
  rechazada: { label: 'Rechazada', tone: 'error', Icon: Block },
  vencida: { label: 'Vencida', tone: 'neutral', Icon: EventBusy },
  // Ficha
  confirmada: { label: 'Confirmada', tone: 'success', Icon: EventAvailable },
  en_espera: { label: 'En sala de espera', tone: 'info', Icon: Chair },
  llamada: { label: 'Llamada', tone: 'info', Icon: Campaign },
  llamando: { label: 'Llamando', tone: 'info', Icon: Campaign },
  en_atencion: { label: 'En atención', tone: 'primary', Icon: MedicalServices },
  atendida: { label: 'Atendida', tone: 'success', Icon: TaskAlt },
  ausente: { label: 'No se presentó', tone: 'error', Icon: PersonOff },
  cancelada: { label: 'Cancelada', tone: 'neutral', Icon: Cancel },
  reprogramada: { label: 'Reprogramada', tone: 'neutral', Icon: EventRepeat },
  // Generales
  activo: { label: 'Activo', tone: 'success', Icon: ToggleOn },
  inactivo: { label: 'Inactivo', tone: 'neutral', Icon: ToggleOff },
  bloqueado: { label: 'Bloqueado', tone: 'error', Icon: Lock },
  preferente: { label: 'Preferente', tone: 'primary', Icon: Accessible },
  web: { label: 'Web', tone: 'info', Icon: Language },
  ventanilla: { label: 'Ventanilla', tone: 'neutral', Icon: Storefront },
};

/** Etiqueta para el ciudadano: en el portal la ficha `en_espera` se muestra como "En espera". */
export const PUBLIC_LABELS = { en_espera: 'En espera', llamada: 'Llamando' };
