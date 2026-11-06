/** /medicos-de-turno — profesionales que atienden hoy y mañana en el centro elegido. */
import { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import Schedule from '@mui/icons-material/Schedule';
import MeetingRoom from '@mui/icons-material/MeetingRoom';
import EventBusy from '@mui/icons-material/EventBusy';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import RequireCenter from '@/components/centers/RequireCenter';
import SelectedCenterBanner from '@/components/centers/SelectedCenterBanner';
import DoctorAvatar from '@/components/portal/DoctorAvatar';
import { useAsync } from '@/hooks/useAsync';
import { useCenter } from '@/context/CenterContext';
import { doctorService } from '@/services/doctorService';
import { PORTAL_COLLECTIONS } from '@/services/portalSnapshot';
import { addDays, formatDateLong, today } from '@/utils/dates';

const DUTY_STATUS = {
  en_turno: { label: 'Atendiendo ahora', tone: 'success' },
  proximo: { label: 'Atiende más tarde', tone: 'info' },
  programado: { label: 'Programado', tone: 'info' },
  finalizado: { label: 'Turno finalizado', tone: 'neutral' },
};

function DutyChip({ estado }) {
  const s = DUTY_STATUS[estado];
  return (
    <Chip
      size="small"
      label={s.label}
      variant="outlined"
      sx={(t) => ({
        bgcolor: t.palette.status[s.tone].bg,
        color: t.palette.status[s.tone].fg,
        borderColor: t.palette.status[s.tone].border,
        fontWeight: 600,
      })}
    />
  );
}

function webText(b) {
  if (!b.aceptaWeb) return 'Solo ventanilla';
  if (b.estado === 'finalizado') return null;
  return b.publicosLibres > 0
    ? `${b.publicosLibres} de ${b.cuposPublicos} fichas por internet libres`
    : 'Sin fichas por internet libres';
}

function DoctorCard({ d }) {
  return (
    <Card
      component="article"
      aria-label={d.nombre}
      sx={{ height: '100%', opacity: d.estado === 'finalizado' ? 0.85 : 1 }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
          <DoctorAvatar iniciales={d.iniciales} size={48} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              {d.nombre}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {d.especialidades.join(' · ')}
            </Typography>
          </Box>
        </Stack>
        <DutyChip estado={d.estado} />
        <Stack
          spacing={1.25}
          sx={{ mt: 2 }}
          component="ul"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {d.bloques.map((b) => (
            <Box component="li" key={b.horarioId} sx={{ p: 1.25, borderRadius: 2, bgcolor: 'subtle' }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Schedule fontSize="inherit" aria-hidden /> {b.horaInicio} a {b.horaFin}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {b.especialidad}
                </Typography>
              </Stack>
              {b.consultorio && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}
                >
                  <MeetingRoom fontSize="inherit" aria-hidden /> {b.consultorio}
                </Typography>
              )}
              {webText(b) && (
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
                  {webText(b)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function useDutyList({ fecha, especialidad }) {
  const { centerId } = useCenter();
  const { data, loading } = useAsync(
    () => doctorService.getDoctorsOnDuty(centerId, fecha),
    [centerId, fecha],
    { watch: PORTAL_COLLECTIONS },
  );
  const list = useMemo(
    () =>
      (data || [])
        .filter((d) => !especialidad || d.bloques.some((b) => b.especialidadId === especialidad))
        .map((d) =>
          especialidad ? { ...d, bloques: d.bloques.filter((b) => b.especialidadId === especialidad) } : d,
        ),
    [data, especialidad],
  );
  const options = useMemo(() => {
    const m = new Map();
    for (const d of data || []) for (const b of d.bloques) m.set(b.especialidadId, b.especialidad);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [data]);
  return { list, options, loading };
}

export default function DoctorsOnDutyPage() {
  const { center } = useCenter();
  const [params, setParams] = useSearchParams();
  const manana = params.get('dia') === 'manana';
  const especialidad = params.get('especialidad') || '';
  const fecha = manana ? addDays(today(), 1) : today();
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <PageHeader
        title="Médicos de turno"
        subtitle="Profesionales que atienden hoy y mañana según su horario y novedades de agenda."
        description="Médicos de turno de hoy y mañana en el centro de salud seleccionado."
      />
      {center && (
        <Box sx={{ mb: 3 }}>
          <SelectedCenterBanner />
        </Box>
      )}
      <RequireCenter>
        <DutyContent fecha={fecha} manana={manana} especialidad={especialidad} set={set} />
      </RequireCenter>
    </Container>
  );
}

function DutyContent({ fecha, manana, especialidad, set }) {
  const { list, options, loading } = useDutyList({ fecha, especialidad });
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}
      >
        <Tabs
          value={manana ? 1 : 0}
          onChange={(_e, v) => set('dia', v === 1 ? 'manana' : '')}
          aria-label="Día"
        >
          <Tab label="Hoy" sx={{ minHeight: 48 }} />
          <Tab label="Mañana" sx={{ minHeight: 48 }} />
        </Tabs>
        <TextField
          select
          size="small"
          label="Especialidad"
          value={especialidad}
          onChange={(e) => set('especialidad', e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {options.map(([id, nombre]) => (
            <MenuItem key={id} value={id}>
              {nombre}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2, '&::first-letter': { textTransform: 'uppercase' } }}>
        {formatDateLong(fecha)}
      </Typography>
      {loading ? (
        <Grid container spacing={2}>
          {[0, 1, 2].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
          ))}
        </Grid>
      ) : list.length === 0 ? (
        <EmptyState
          icon={EventBusy}
          title={manana ? 'Mañana no hay profesionales programados' : 'Hoy no hay profesionales de turno'}
          description="Puede deberse a un feriado, fin de semana o novedades en la agenda."
          action={!manana ? { label: 'Ver mañana', onClick: () => set('dia', 'manana') } : undefined}
          sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
        />
      ) : (
        <Grid container spacing={2}>
          {list.map((d) => (
            <Grid key={d.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <DoctorCard d={d} />
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}
