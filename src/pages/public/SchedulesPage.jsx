/** /horarios — horario general del centro y horario semanal por especialidad. */
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  CardHeader,
  Container,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import PageHeader from '@/components/common/PageHeader';
import RequireCenter from '@/components/centers/RequireCenter';
import SelectedCenterBanner from '@/components/centers/SelectedCenterBanner';
import CenterHoursTable from '@/components/centers/CenterHoursTable';
import SpecialtyIcon from '@/components/portal/SpecialtyIcon';
import { useAsync } from '@/hooks/useAsync';
import { useCenter } from '@/context/CenterContext';
import { scheduleService } from '@/services/scheduleService';
import { PORTAL_COLLECTIONS } from '@/services/portalSnapshot';
import { DIAS_SEMANA } from '@/config/constants';
import { formatDateLong, isoWeekday, today } from '@/utils/dates';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const SHORT = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };

function Slots({ slots, showDoctor = true }) {
  if (!slots.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }
  return (
    <Stack spacing={0.75}>
      {slots.map((s, i) => (
        <Box key={i}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
          >
            {s.horaInicio}–{s.horaFin}
          </Typography>
          {showDoctor && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
              {s.medico}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function WeeklyTable({ especialidades, hoy }) {
  return (
    <TableContainer component={Card}>
      <Table size="small" aria-label="Horario semanal por especialidad">
        <TableHead>
          <TableRow>
            <TableCell>Especialidad</TableCell>
            {DAYS.map((d) => (
              <TableCell
                key={d}
                align="center"
                sx={d === hoy ? { color: 'primary.main !important', fontWeight: 700 } : undefined}
              >
                <abbr title={DIAS_SEMANA[d]} style={{ textDecoration: 'none' }}>
                  {SHORT[d]}
                </abbr>
                {d === hoy && ' (hoy)'}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {especialidades.map((e) => (
            <TableRow key={e.id}>
              <TableCell component="th" scope="row" sx={{ minWidth: 160 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <SpecialtyIcon name={e.icono} fontSize="small" color="primary" aria-hidden />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {e.nombre}
                    </Typography>
                    {!e.aceptaSolicitudesPublicas && (
                      <Typography variant="caption" color="text.secondary">
                        Solo ventanilla
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </TableCell>
              {DAYS.map((d) => (
                <TableCell
                  key={d}
                  align="center"
                  sx={{
                    verticalAlign: 'top',
                    bgcolor: d === hoy ? 'action.selected' : d >= 6 ? 'action.hover' : undefined,
                  }}
                >
                  <Slots slots={e.porDia[d]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SpecialtyDayList({ e, hoy }) {
  const days = DAYS.filter((d) => e.porDia[d].length);
  return (
    <Card component="section" aria-label={e.nombre}>
      <CardHeader
        avatar={<SpecialtyIcon name={e.icono} color="primary" aria-hidden />}
        title={e.nombre}
        subheader={e.aceptaSolicitudesPublicas ? null : 'Solo ventanilla'}
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Stack spacing={1}>
          {days.map((d) => (
            <Stack
              key={d}
              direction="row"
              spacing={2}
              sx={{ p: 1, borderRadius: 1.5, bgcolor: d === hoy ? 'action.selected' : 'transparent' }}
            >
              <Typography
                variant="body2"
                sx={{ width: 92, flexShrink: 0, fontWeight: d === hoy ? 700 : 500 }}
              >
                {DIAS_SEMANA[d]}
                {d === hoy && ' (hoy)'}
              </Typography>
              <Slots slots={e.porDia[d]} />
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function SchedulesContent() {
  const { center, centerId } = useCenter();
  const wide = useMediaQuery((t) => t.breakpoints.up('lg'));
  const { data, loading } = useAsync(() => scheduleService.getCenterSchedule(centerId), [centerId], {
    watch: PORTAL_COLLECTIONS,
  });
  const hoy = isoWeekday(today());

  if (loading || !data) return <Skeleton variant="rounded" height={360} />;
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardHeader title="Horario del establecimiento" subheader="Atención general" />
          <CardContent sx={{ pt: 0 }}>
            <CenterHoursTable center={center} />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 7, lg: 8 }}>
        {data.cierres.length > 0 ? (
          <Alert severity="warning">
            <AlertTitle>Días sin atención próximos</AlertTitle>
            <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2 }}>
              {data.cierres.map((c) => (
                <li key={c.fecha}>
                  <strong>{capitalize(formatDateLong(c.fecha))}</strong>: {c.motivo}
                </li>
              ))}
            </Stack>
          </Alert>
        ) : (
          <Alert severity="info">No hay feriados ni cierres programados en las próximas dos semanas.</Alert>
        )}
      </Grid>
      <Grid size={12}>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Horario por especialidad
        </Typography>
        {wide ? (
          <WeeklyTable especialidades={data.especialidades} hoy={hoy} />
        ) : (
          <Stack spacing={2}>
            {data.especialidades.map((e) => (
              <SpecialtyDayList key={e.id} e={e} hoy={hoy} />
            ))}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Los horarios pueden variar por permisos o ausencias del profesional. Consulte “Médicos de turno”
          para hoy y mañana.
        </Typography>
      </Grid>
    </Grid>
  );
}

export default function SchedulesPage() {
  const { center } = useCenter();
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <PageHeader
        title="Horarios de atención"
        subtitle="Horario general y por especialidad del centro elegido."
        description="Horarios de atención generales y por especialidad del centro de salud."
      />
      {center && (
        <Box sx={{ mb: 3 }}>
          <SelectedCenterBanner />
        </Box>
      )}
      <RequireCenter>
        <SchedulesContent />
      </RequireCenter>
    </Container>
  );
}
