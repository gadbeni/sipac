import { Box, Stack, Typography } from '@mui/material';
import EventAvailable from '@mui/icons-material/EventAvailable';
import EventBusy from '@mui/icons-material/EventBusy';
import Storefront from '@mui/icons-material/Storefront';
import { formatDate, today, addDays, isoWeekday } from '@/utils/dates';
import { DIAS_SEMANA } from '@/config/constants';

const HOY_MOTIVO = {
  CIERRE_MISMO_DIA: 'Hoy ya no se reciben solicitudes por internet.',
  SIN_CUPOS: 'Hoy no quedan fichas por internet.',
  DEMANDA_ALTA: 'Hoy hay demanda alta.',
  SIN_HORARIO: 'Hoy no atiende.',
  BLOQUEADO: 'Hoy no hay atención.',
};

const dayLabel = (fecha) => {
  if (fecha === today()) return 'hoy';
  if (fecha === addDays(today(), 1)) return 'mañana';
  return `el ${DIAS_SEMANA[isoWeekday(fecha)].toLowerCase()} ${formatDate(fecha).slice(0, 5)}`;
};

/** Fichas por internet disponibles (cupos públicos libres del motor de disponibilidad). */
export default function AvailabilitySummary({ especialidad: e }) {
  let tone = 'success';
  let Icon = EventAvailable;
  let main;
  let detail = null;
  if (!e.aceptaSolicitudesPublicas) {
    tone = 'neutral';
    Icon = Storefront;
    main = 'Solo con ficha en ventanilla';
    detail = 'Acérquese al centro en el horario de atención.';
  } else if (e.hoy.publicosLibres > 0) {
    main = `${e.hoy.publicosLibres} ${e.hoy.publicosLibres === 1 ? 'ficha disponible' : 'fichas disponibles'} hoy`;
  } else if (e.proxima) {
    tone = 'info';
    main = `${e.proxima.publicosLibres} ${e.proxima.publicosLibres === 1 ? 'ficha disponible' : 'fichas disponibles'} ${dayLabel(e.proxima.fecha)}`;
    detail = HOY_MOTIVO[e.hoy.motivo] || null;
  } else {
    tone = 'warning';
    Icon = EventBusy;
    main = 'Sin fichas por internet en los próximos días';
  }
  return (
    <Box
      sx={(t) => ({
        p: 1.25,
        borderRadius: 2,
        bgcolor: t.palette.status[tone].bg,
        color: t.palette.status[tone].fg,
        border: `1px solid ${t.palette.status[tone].border}`,
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Icon fontSize="small" aria-hidden sx={{ mt: '2px' }} />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {main}
          </Typography>
          {detail && (
            <Typography variant="caption" component="p">
              {detail}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
