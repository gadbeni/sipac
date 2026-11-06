/** /admin — dashboard del centro activo (o de todos), vista reducida para médicos (Épica 7). */
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ConfirmationNumber from '@mui/icons-material/ConfirmationNumber';
import EventSeat from '@mui/icons-material/EventSeat';
import Assignment from '@mui/icons-material/Assignment';
import Chair from '@mui/icons-material/Chair';
import TaskAlt from '@mui/icons-material/TaskAlt';
import PieChartOutline from '@mui/icons-material/PieChartOutlineOutlined';
import PendingActions from '@mui/icons-material/PendingActions';
import Lightbulb from '@mui/icons-material/Lightbulb';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import KpiCard from '@/components/common/KpiCard';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import {
  ByHourChart,
  DemandBySpecialtyChart,
  IssuedVsAttendedChart,
  RequestsByDayChart,
} from '@/components/charts/DashboardCharts';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { reportService, DASHBOARD_COLLECTIONS } from '@/services/reportService';
import { formatDateLong, formatTime, nowIso } from '@/utils/dates';

const WATCH = [...DASHBOARD_COLLECTIONS, 'notificaciones'];
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const pctText = (v) => (v == null ? '—' : `${v.toLocaleString('es-BO')}`);

function Insights({ items }) {
  if (!items?.length) {
    return (
      <Alert severity="success" icon={<Lightbulb />}>
        Sin alertas: la operación del día no presenta situaciones que requieran atención.
      </Alert>
    );
  }
  return (
    <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label="Avisos del día">
      {items.map((i) => (
        <Box component="li" key={i.id}>
          <Alert
            severity={i.severity}
            action={
              i.link && (
                <Button
                  color="inherit"
                  size="small"
                  component={RouterLink}
                  to={i.link.to}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {i.link.label}
                </Button>
              )
            }
            sx={{
              '& .MuiAlert-action': { alignItems: 'center', pt: 0 },
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            <AlertTitle sx={{ mb: 0.25 }}>{i.title}</AlertTitle>
            {i.text}
          </Alert>
        </Box>
      ))}
    </Stack>
  );
}

function CenterKpis({ k, loading, navigate }) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
        <KpiCard
          label="Fichas para hoy"
          value={k?.fichasHoy}
          helper={k && `${k.porAtender} por atender`}
          icon={ConfirmationNumber}
          loading={loading}
          onClick={() => navigate('/admin/entrega')}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
        <KpiCard
          label="Cupos libres hoy"
          value={k?.fichasDisponibles}
          helper={k && `de ${k.cuposEfectivosHoy.toLocaleString('es-BO')} cupos efectivos`}
          icon={EventSeat}
          tone="success"
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
        <KpiCard
          label="Solicitudes pendientes"
          value={k?.solicitudesPendientes}
          helper={k && `${k.pendientesHoyManana} para hoy y mañana · ${k.listaEspera} en lista de espera`}
          icon={Assignment}
          tone="warning"
          loading={loading}
          onClick={() => navigate('/admin/solicitudes?tab=pendientes')}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
        <KpiCard
          label="En sala de espera"
          value={k?.enEspera}
          helper={k && `${k.enAtencion} en atención ahora`}
          icon={Chair}
          tone="info"
          loading={loading}
          onClick={() => navigate('/admin/entrega')}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
        <KpiCard
          label="Atendidos hoy"
          value={k?.atendidos}
          helper={
            k &&
            (k.esperaPromedioMin != null
              ? `Espera promedio (7 días): ${k.esperaPromedioMin} min`
              : 'Sin datos de espera')
          }
          icon={TaskAlt}
          tone="success"
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
        <KpiCard
          label="Ocupación de hoy"
          value={pctText(k?.ocupacionPct)}
          unit={k?.ocupacionPct != null ? '%' : undefined}
          helper={
            k && `Ausentismo (7 días): ${pctText(k.ausentismoPct)}${k.ausentismoPct != null ? ' %' : ''}`
          }
          icon={PieChartOutline}
          tone="primary"
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}

function DoctorView({ d, loading }) {
  const k = d?.kpis;
  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            label="Mis fichas de hoy"
            value={k?.fichasHoy}
            icon={ConfirmationNumber}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            label="Por atender"
            value={k?.porAtender}
            icon={PendingActions}
            tone="warning"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard label="En sala de espera" value={k?.enEspera} icon={Chair} tone="info" loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard label="Atendidos" value={k?.atendidos} icon={TaskAlt} tone="success" loading={loading} />
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Mi agenda de hoy"
              subheader={d?.centro?.nombre}
              action={
                <Button component={RouterLink} to="/admin/agenda">
                  Ver agenda
                </Button>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              {loading ? (
                <Skeleton variant="rounded" height={200} />
              ) : !d.agenda.length ? (
                <Typography color="text.secondary">No tiene fichas asignadas hoy en este centro.</Typography>
              ) : (
                <List dense disablePadding aria-label="Fichas de hoy">
                  {d.agenda.map((f) => (
                    <ListItem key={f.id} divider sx={{ gap: 1.5, flexWrap: 'wrap', px: 0 }}>
                      <Typography sx={{ fontWeight: 700, width: 52, fontVariantNumeric: 'tabular-nums' }}>
                        {f.hora}
                      </Typography>
                      <Chip size="small" label={f.codigo} sx={{ fontWeight: 700 }} />
                      <ListItemText
                        primary={f.paciente}
                        secondary={`${f.especialidad} · ${f.consultorio || ''}`}
                        sx={{ minWidth: 150 }}
                      />
                      {f.prioridad === 'preferente' && <StatusChip estado="preferente" />}
                      <StatusChip estado={f.estado} />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <IssuedVsAttendedChart
            rows={d?.emitidasVsAtendidas}
            loading={loading}
            subtitle="Mis fichas, últimos 7 días"
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

export default function DashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const {
    data: d,
    loading,
    error,
  } = useAsync(() => reportService.getDashboard(session), [session.usuarioId, session.activeCenterId], {
    watch: WATCH,
  });
  const scopeLabel = d ? (d.centro ? d.centro.nombre : 'Todos los centros de la red') : '';

  return (
    <>
      <PageHeader
        title={
          d?.vista === 'medico' ? `Hola, ${session.nombre.split(' ').slice(0, 2).join(' ')}` : 'Dashboard'
        }
        subtitle={
          d ? `${scopeLabel} · ${cap(formatDateLong(d.today))} · datos al ${formatTime(nowIso())}` : ' '
        }
        documentTitle="Dashboard"
      />
      {error && <Alert severity="error">{error.message}</Alert>}
      {d?.centro && !d.centro.activo && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Este centro está inactivo: no recibe solicitudes ni emite fichas. Se muestra su historial.
        </Alert>
      )}
      {(loading && !d) || d?.vista !== 'medico' ? (
        <Stack spacing={3}>
          <CenterKpis k={d?.kpis} loading={loading && !d} navigate={navigate} />
          <Box component="section" aria-labelledby="avisos-title">
            <Typography id="avisos-title" variant="h6" component="h2" sx={{ mb: 1.5 }}>
              Avisos del día
            </Typography>
            {d ? <Insights items={d.insights} /> : <Skeleton variant="rounded" height={64} />}
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <RequestsByDayChart rows={d?.solicitudesPorDia} loading={!d} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <DemandBySpecialtyChart rows={d?.demanda} loading={!d} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <IssuedVsAttendedChart rows={d?.emitidasVsAtendidas} loading={!d} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <ByHourChart rows={d?.porFranja} loading={!d} />
            </Grid>
          </Grid>
          {d?.porCentro && (
            <DataTable
              title="Resumen por centro (hoy)"
              searchable={false}
              rows={d.porCentro}
              initialSort={{ field: 'fichasHoy', direction: 'desc' }}
              ariaLabel="Resumen por centro"
              columns={[
                { field: 'nombre', header: 'Centro', primary: true },
                { field: 'fichasHoy', header: 'Fichas hoy', align: 'right' },
                { field: 'fichasDisponibles', header: 'Cupos libres', align: 'right' },
                { field: 'solicitudesPendientes', header: 'Pendientes', align: 'right' },
                { field: 'enEspera', header: 'En espera', align: 'right' },
                {
                  field: 'ocupacionPct',
                  header: 'Ocupación',
                  align: 'right',
                  render: (r) =>
                    r.ocupacionPct == null ? '—' : `${r.ocupacionPct.toLocaleString('es-BO')} %`,
                },
              ]}
            />
          )}
        </Stack>
      ) : (
        <DoctorView d={d} loading={loading && !d} />
      )}
    </>
  );
}
