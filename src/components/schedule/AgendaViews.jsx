/** Vistas de agenda (D-19: componentes propios sobre MUI, sin FullCalendar). */
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import EventBusy from '@mui/icons-material/EventBusy';
import BlockCard from './BlockCard';
import StatusChip from '@/components/common/StatusChip';
import EmptyState from '@/components/common/EmptyState';
import { DIAS_SEMANA } from '@/config/constants';
import { formatDateLong, today } from '@/utils/dates';

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const SHORT = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function AgendaDayView({ day }) {
  if (!day) return null;
  return (
    <Stack spacing={2}>
      {day.cierre && <Alert severity="warning">{day.cierre.motivo}</Alert>}
      {day.bloques.length === 0 ? (
        <EmptyState
          icon={EventBusy}
          title="Sin bloques de atención este día"
          sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
        />
      ) : (
        <Grid container spacing={2}>
          {day.bloques.map((b) => (
            <Grid key={b.horarioId} size={{ xs: 12, md: 6, xl: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <BlockCard b={b} />
                  <Typography variant="subtitle2" component="h3" sx={{ mt: 1.5 }}>
                    Fichas ({b.fichas?.length || 0})
                  </Typography>
                  {b.fichas?.length ? (
                    <List dense disablePadding>
                      {b.fichas.map((f) => (
                        <ListItem
                          key={f.id}
                          disableGutters
                          divider
                          secondaryAction={<StatusChip estado={f.estado} />}
                          sx={{ pr: 16 }}
                        >
                          <ListItemText
                            primary={`${f.hora} · ${f.codigo} · ${f.paciente}`}
                            secondary={`${f.canal === 'web' ? 'Web' : 'Ventanilla'}${f.prioridad === 'preferente' ? ' · Preferente' : ''}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Sin fichas emitidas.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}

export function AgendaWeekView({ days, onDay }) {
  const wide = useMediaQuery((t) => t.breakpoints.up('lg'));
  const hoy = today();
  if (!wide) {
    return (
      <Stack spacing={2}>
        {days.map((d) => (
          <Card key={d.fecha} sx={{ borderColor: d.fecha === hoy ? 'primary.main' : 'divider' }}>
            <CardHeader
              title={cap(formatDateLong(d.fecha))}
              subheader={d.cierre ? d.cierre.motivo : `${d.totales.ocupados}/${d.totales.efectivos} ocupados`}
              sx={{ pb: 0 }}
              onClick={() => onDay(d.fecha)}
            />
            <CardContent>
              {d.bloques.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin atención.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {d.bloques.map((b) => (
                    <BlockCard key={b.horarioId} b={b} onClick={() => onDay(d.fecha)} />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }
  return (
    <Box
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1 }}
      role="grid"
      aria-label="Agenda semanal"
    >
      {days.map((d) => (
        <Box key={d.fecha} role="gridcell" sx={{ minWidth: 0 }}>
          <Box
            component="button"
            type="button"
            onClick={() => onDay(d.fecha)}
            sx={{
              width: '100%',
              font: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              p: 1,
              mb: 1,
              borderRadius: 1.5,
              border: 1,
              borderColor: d.fecha === hoy ? 'primary.main' : 'divider',
              bgcolor: d.fecha === hoy ? 'action.selected' : 'background.paper',
              color: 'text.primary',
            }}
            aria-label={`Ver ${formatDateLong(d.fecha)}`}
          >
            <Typography variant="subtitle2" component="h3">
              {SHORT[d.diaSemana]} {d.fecha.slice(8)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {d.cierre
                ? d.cierre.motivo
                : d.bloques.length
                  ? `${d.totales.ocupados}/${d.totales.efectivos} ocupados`
                  : 'Sin atención'}
            </Typography>
          </Box>
          <Stack spacing={1}>
            {d.bloques.map((b) => (
              <BlockCard key={b.horarioId} b={b} compact onClick={() => onDay(d.fecha)} />
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

export function AgendaMonthView({ days, month, onDay }) {
  const hoy = today();
  const small = useMediaQuery((t) => t.breakpoints.down('sm'));
  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5, mb: 0.5 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <Typography
            key={d}
            variant="caption"
            sx={{ textAlign: 'center', fontWeight: 700 }}
            color="text.secondary"
          >
            <abbr title={DIAS_SEMANA[d]} style={{ textDecoration: 'none' }}>
              {SHORT[d]}
            </abbr>
          </Typography>
        ))}
      </Box>
      <Box
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}
        role="grid"
        aria-label="Agenda mensual"
      >
        {days.map((d) => {
          const out = d.fecha.slice(0, 7) !== month;
          const pct = d.totales.efectivos ? d.totales.ocupados / d.totales.efectivos : 0;
          const tone = d.cierre
            ? 'warning'
            : !d.bloques.length
              ? 'neutral'
              : pct >= 1
                ? 'error'
                : pct >= 0.8
                  ? 'warning'
                  : 'success';
          return (
            <Box
              key={d.fecha}
              role="gridcell"
              component="button"
              type="button"
              onClick={() => onDay(d.fecha)}
              aria-label={`${formatDateLong(d.fecha)}: ${d.cierre ? d.cierre.motivo : d.bloques.length ? `${d.totales.ocupados} de ${d.totales.efectivos} cupos ocupados` : 'sin atención'}`}
              sx={(t) => ({
                minHeight: small ? 56 : 92,
                p: small ? 0.5 : 1,
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: 1.5,
                border: 1,
                borderColor: d.fecha === hoy ? 'primary.main' : 'divider',
                bgcolor: out ? 'transparent' : 'background.paper',
                color: out ? 'text.disabled' : 'text.primary',
                opacity: out ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                minWidth: 0,
                '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 1 },
              })}
            >
              <Typography variant="body2" sx={{ fontWeight: d.fecha === hoy ? 800 : 600 }}>
                {Number(d.fecha.slice(8))}
              </Typography>
              {!out && (d.cierre || d.bloques.length > 0) && (
                <Chip
                  size="small"
                  label={
                    d.cierre
                      ? small
                        ? '×'
                        : 'Cerrado'
                      : small
                        ? `${Math.round(pct * 100)}%`
                        : `${d.totales.ocupados}/${d.totales.efectivos}`
                  }
                  sx={(t) => ({
                    height: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: t.palette.status[tone].bg,
                    color: t.palette.status[tone].fg,
                    maxWidth: '100%',
                  })}
                />
              )}
              {!small && !out && d.totales.bloqueados > 0 && !d.cierre && (
                <Typography variant="caption" color="text.secondary">
                  {d.totales.bloqueados} bloqueado(s)
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
