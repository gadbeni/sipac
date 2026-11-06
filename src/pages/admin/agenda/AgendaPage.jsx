/** /admin/agenda — agenda Día / Semana / Mes con ocupación calculada (Épica 9). */
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Today from '@mui/icons-material/Today';
import EventBusy from '@mui/icons-material/EventBusy';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { AgendaDayView, AgendaMonthView, AgendaWeekView } from '@/components/schedule/AgendaViews';
import ExceptionDialog from '@/components/operations/ExceptionDialog';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { agendaService } from '@/services/agendaService';
import { monthGrid, weekStart } from '@/services/rules/agenda';
import { addDays, formatDate, formatDateLong, today } from '@/utils/dates';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

export default function AgendaPage() {
  const { session, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const vista = ['dia', 'semana', 'mes'].includes(params.get('vista')) ? params.get('vista') : 'semana';
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.get('fecha') || '') ? params.get('fecha') : today();
  const medicoId = session.rol === 'medico' ? '' : params.get('medico') || '';
  const especialidadId = params.get('especialidad') || '';
  const [exc, setExc] = useState(false);
  const set = (patch) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    setParams(n, { replace: true });
  };
  const range = useMemo(() => {
    if (vista === 'dia') return { desde: fecha, hasta: fecha };
    if (vista === 'semana') {
      const s = weekStart(fecha);
      return { desde: s, hasta: addDays(s, 6) };
    }
    const g = monthGrid(fecha);
    return { desde: g.start, hasta: g.end };
  }, [vista, fecha]);
  const needCenter = !session.activeCenterId;
  const opts = useMemo(
    () => (needCenter ? { medicos: [], especialidades: [] } : agendaService.filterOptions(session)),
    [needCenter, session],
  );
  const { data, loading, error } = useAsync(
    () =>
      needCenter
        ? null
        : agendaService.getAgenda(session, {
            ...range,
            medicoId,
            especialidadId,
            conFichas: vista === 'dia',
          }),
    [range.desde, range.hasta, medicoId, especialidadId, vista, session.activeCenterId],
    { watch: ['fichas', 'horarios', 'excepcionesAgenda', 'medicoCentros'] },
  );

  const step = (dir) =>
    set({
      fecha:
        vista === 'dia'
          ? addDays(fecha, dir)
          : vista === 'semana'
            ? addDays(fecha, 7 * dir)
            : addDays(`${fecha.slice(0, 7)}-15`, 30 * dir),
    });
  const title =
    vista === 'dia'
      ? cap(formatDateLong(fecha))
      : vista === 'semana'
        ? `Semana del ${formatDate(range.desde)} al ${formatDate(range.hasta)}`
        : `${cap(MESES[Number(fecha.slice(5, 7)) - 1])} ${fecha.slice(0, 4)}`;
  const totals = data?.reduce(
    (a, d) =>
      vista === 'mes' && d.fecha.slice(0, 7) !== fecha.slice(0, 7)
        ? a
        : { o: a.o + d.totales.ocupados, e: a.e + d.totales.efectivos },
    { o: 0, e: 0 },
  );

  return (
    <>
      <PageHeader
        title="Agenda médica"
        subtitle={
          session.rol === 'medico'
            ? 'Su agenda en el centro de trabajo.'
            : 'Bloques de atención con cupos ocupados y efectivos, calculados con horarios y novedades.'
        }
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Agenda' }]}
        actions={
          can('agenda.gestionar') &&
          !needCenter && (
            <Button variant="contained" startIcon={<EventBusy />} onClick={() => setExc(true)}>
              Registrar novedad
            </Button>
          )
        }
      />
      {needCenter ? (
        <Alert severity="info">Elija un centro de trabajo en la barra superior.</Alert>
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ mb: 2, alignItems: { md: 'center' } }}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={vista}
              onChange={(_e, v) => v && set({ vista: v })}
              aria-label="Vista"
              sx={{ '& .MuiToggleButton-root': { minHeight: 40, px: 2, textTransform: 'none' } }}
            >
              <ToggleButton value="dia">Día</ToggleButton>
              <ToggleButton value="semana">Semana</ToggleButton>
              <ToggleButton value="mes">Mes</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Tooltip title="Anterior">
                <IconButton onClick={() => step(-1)} aria-label="Anterior">
                  <ChevronLeft />
                </IconButton>
              </Tooltip>
              <Button startIcon={<Today />} onClick={() => set({ fecha: '' })} size="small">
                Hoy
              </Button>
              <Tooltip title="Siguiente">
                <IconButton onClick={() => step(1)} aria-label="Siguiente">
                  <ChevronRight />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="h6" component="h2" sx={{ flex: 1 }} aria-live="polite">
              {title}
            </Typography>
            {session.rol !== 'medico' && (
              <TextField
                select
                size="small"
                label="Profesional"
                value={medicoId}
                onChange={(e) => set({ medico: e.target.value })}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Todos</MenuItem>
                {opts.medicos.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              size="small"
              label="Especialidad"
              value={especialidadId}
              onChange={(e) => set({ especialidad: e.target.value })}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {opts.especialidades.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {totals && vista !== 'dia' && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {totals.o} de {totals.e} cupos ocupados en el período (
              {totals.e ? Math.round((totals.o / totals.e) * 100) : 0} %).
            </Typography>
          )}
          {error ? (
            <Alert severity="error">{error.message}</Alert>
          ) : !data ? (
            <Skeleton variant="rounded" height={360} />
          ) : vista === 'dia' ? (
            <AgendaDayView day={data[0]} />
          ) : vista === 'semana' ? (
            <AgendaWeekView days={data} onDay={(f) => set({ vista: 'dia', fecha: f })} />
          ) : (
            <AgendaMonthView
              days={data}
              month={fecha.slice(0, 7)}
              onDay={(f) => set({ vista: 'dia', fecha: f })}
            />
          )}
          {loading && data && (
            <Typography variant="caption" color="text.secondary">
              Actualizando…
            </Typography>
          )}
        </>
      )}
      <ExceptionDialog
        open={exc}
        preset={{
          medicoId,
          fechaInicio: fecha > today() ? fecha : addDays(today(), 1),
          fechaFin: fecha > today() ? fecha : addDays(today(), 1),
        }}
        onClose={() => setExc(false)}
      />
    </>
  );
}
