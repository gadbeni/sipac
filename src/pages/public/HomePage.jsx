/** / — portada del portal ciudadano. */
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Category from '@mui/icons-material/Category';
import MedicalServices from '@mui/icons-material/MedicalServices';
import Schedule from '@mui/icons-material/Schedule';
import LocalHospital from '@mui/icons-material/LocalHospital';
import Search from '@mui/icons-material/Search';
import ConfirmationNumber from '@mui/icons-material/ConfirmationNumber';
import EventAvailable from '@mui/icons-material/EventAvailable';
import Campaign from '@mui/icons-material/Campaign';
import AccessTime from '@mui/icons-material/AccessTime';
import { Link as RouterLink } from 'react-router-dom';
import SelectedCenterBanner from '@/components/centers/SelectedCenterBanner';
import KpiCard from '@/components/common/KpiCard';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useRequestTicket } from '@/hooks/useRequestTicket';
import { useCenter } from '@/context/CenterContext';
import { scheduleService } from '@/services/scheduleService';
import { PORTAL_COLLECTIONS } from '@/services/portalSnapshot';
import { openStatusLabel } from '@/services/rules/centers';
import { appConfig } from '@/config/app.config';

const LINKS = [
  {
    to: '/especialidades',
    title: 'Especialidades',
    text: 'Servicios del centro y fichas disponibles.',
    Icon: Category,
  },
  {
    to: '/medicos-de-turno',
    title: 'Médicos de turno',
    text: 'Quién atiende hoy y mañana.',
    Icon: MedicalServices,
  },
  { to: '/horarios', title: 'Horarios', text: 'Horario general y por especialidad.', Icon: Schedule },
  {
    to: '/centros',
    title: 'Centros de salud',
    text: 'Busque en el mapa o por municipio.',
    Icon: LocalHospital,
  },
];

const STEPS = [
  {
    Icon: LocalHospital,
    title: 'Elija su centro',
    text: 'Busque el establecimiento por nombre, municipio o cercanía.',
  },
  {
    Icon: ConfirmationNumber,
    title: 'Solicite la ficha',
    text: 'Seleccione especialidad, fecha y complete sus datos. Recibirá un código.',
  },
  {
    Icon: EventAvailable,
    title: 'Espere la confirmación',
    text: 'El centro revisa la solicitud y asigna su ficha. Consulte el estado con su código.',
  },
  {
    Icon: Campaign,
    title: 'Preséntese el día indicado',
    text: 'Llegue antes de la hora estimada con su documento. Si no asiste, su documento quedará bloqueado para nuevas fichas.',
  },
];

function DaySummary() {
  const { centerId } = useCenter();
  const { data, loading } = useAsync(() => scheduleService.getDaySummary(centerId), [centerId], {
    watch: PORTAL_COLLECTIONS,
  });
  const ap = data && openStatusLabel(data.apertura);
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <KpiCard
          label="Estado del centro"
          value={ap ? ap.label.split(' · ')[0] : ''}
          helper={ap?.label.split(' · ')[1]}
          icon={AccessTime}
          tone={ap?.tone === 'success' ? 'success' : 'neutral'}
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <KpiCard
          label="Fichas por internet hoy"
          value={data?.fichasWebHoy ?? 0}
          helper={
            data ? `En ${data.especialidadesConFichasHoy} de ${data.especialidades} especialidades` : null
          }
          icon={ConfirmationNumber}
          tone="primary"
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <KpiCard
          label="Profesionales de turno hoy"
          value={data?.medicosHoy ?? 0}
          helper={data ? `${data.medicosAhora} atendiendo ahora` : null}
          icon={MedicalServices}
          tone="info"
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}

export default function HomePage() {
  useDocumentMeta(
    null,
    'Solicite fichas médicas por internet en los centros de salud de la red y consulte especialidades, médicos de turno y horarios.',
  );
  const { center } = useCenter();
  const request = useRequestTicket();

  return (
    <>
      <Box
        component="section"
        aria-labelledby="hero-title"
        sx={(t) => ({
          background: `linear-gradient(135deg, ${alpha(t.palette.brand, t.palette.mode === 'dark' ? 0.22 : 0.14)} 0%, ${alpha(t.palette.secondary.main, 0.06)} 60%, transparent 100%)`,
          borderBottom: 1,
          borderColor: 'divider',
        })}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
          <Grid container spacing={4} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="overline" color="primary" component="p">
                {appConfig.institution.name}
              </Typography>
              <Typography
                id="hero-title"
                variant="h1"
                sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, mb: 2 }}
              >
                Su ficha médica, sin hacer fila desde la madrugada
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: '1.125rem', mb: 3, maxWidth: 560 }}>
                Solicite su ficha por internet en el centro de salud de su barrio, consulte qué médicos
                atienden y conozca los horarios.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  size="large"
                  variant="contained"
                  startIcon={<ConfirmationNumber />}
                  onClick={() => request()}
                >
                  Solicitar ficha
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  startIcon={<Search />}
                  component={RouterLink}
                  to="/consultar"
                >
                  Consultar mi solicitud
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <SelectedCenterBanner title="Centro seleccionado" />
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {center && (
          <Box component="section" aria-labelledby="hoy-title" sx={{ mb: 5 }}>
            <Typography id="hoy-title" variant="h5" component="h2" sx={{ mb: 2 }}>
              Hoy en {center.nombre}
            </Typography>
            <DaySummary />
          </Box>
        )}

        <Box component="section" aria-labelledby="accesos-title" sx={{ mb: 6 }}>
          <Typography id="accesos-title" variant="h5" component="h2" sx={{ mb: 2 }}>
            Información del centro
          </Typography>
          <Grid container spacing={2}>
            {LINKS.map(({ to, title, text, Icon }) => (
              <Grid key={to} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card sx={{ height: '100%' }}>
                  <CardActionArea
                    component={RouterLink}
                    to={to}
                    sx={{
                      height: '100%',
                      p: 2.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 1,
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={(t) => ({
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: t.palette.status.primary.bg,
                        color: t.palette.status.primary.fg,
                      })}
                    >
                      <Icon />
                    </Box>
                    <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {text}
                    </Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box component="section" aria-labelledby="pasos-title">
          <Typography id="pasos-title" variant="h5" component="h2" sx={{ mb: 2 }}>
            ¿Cómo funciona?
          </Typography>
          <Grid container spacing={2} component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {STEPS.map(({ Icon, title, text }, i) => (
              <Grid key={title} size={{ xs: 12, sm: 6, md: 3 }} component="li">
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}
                      </Box>
                      <Icon color="primary" aria-hidden />
                    </Stack>
                    <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {text}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </>
  );
}
