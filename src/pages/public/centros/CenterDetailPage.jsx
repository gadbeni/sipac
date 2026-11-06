/** /centros/:codigo — información completa de un centro activo. */
import { lazy, Suspense } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Grid,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import Place from '@mui/icons-material/Place';
import Phone from '@mui/icons-material/Phone';
import Email from '@mui/icons-material/Email';
import Directions from '@mui/icons-material/Directions';
import CheckCircle from '@mui/icons-material/CheckCircle';
import LocationOff from '@mui/icons-material/LocationOff';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import CenterImage from '@/components/centers/CenterImage';
import OpenStatusChip from '@/components/centers/OpenStatusChip';
import CenterHoursTable from '@/components/centers/CenterHoursTable';
import MapOfflineNotice from '@/components/centers/MapOfflineNotice';
import { useConnectivity } from '@/context/ConnectivityContext';
import { useAsync } from '@/hooks/useAsync';
import { useCenter } from '@/context/CenterContext';
import { useNotify } from '@/context/NotifyContext';
import { centerService } from '@/services/centerService';
import { NIVELES_ATENCION, TIPOS_CENTRO } from '@/config/constants';
import { formatDate } from '@/utils/dates';

const CenterMap = lazy(() => import('@/components/centers/CenterMap'));

function InfoRow({ icon: Icon, children }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Icon color="action" aria-hidden sx={{ mt: '2px' }} />
      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{children}</Box>
    </Stack>
  );
}

export default function CenterDetailPage() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const { centerId, selectCenter } = useCenter();
  const { online } = useConnectivity();
  const { data: c, loading } = useAsync(() => centerService.getPublicDetail(codigo), [codigo], {
    watch: ['centros', 'centroEspecialidades'],
  });

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Skeleton width="50%" height={48} />
        <Skeleton variant="rounded" height={260} sx={{ mt: 2 }} />
      </Container>
    );
  }

  if (!c) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <PageHeader
          title="Centro no disponible"
          breadcrumbs={[{ label: 'Centros de salud', to: '/centros' }, { label: 'No disponible' }]}
        />
        <EmptyState
          icon={LocationOff}
          title="Este centro de salud no está disponible"
          description="Puede que el código no sea correcto o que el centro no esté atendiendo por el momento."
          action={{ label: 'Ver centros disponibles', to: '/centros' }}
          sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
        />
      </Container>
    );
  }

  const selected = centerId === c.id;
  const select = () => {
    selectCenter(c);
    notify.success(`Centro seleccionado: ${c.nombre}`);
  };
  const request = () => {
    if (!selected) selectCenter(c);
    navigate('/solicitar-ficha');
  };
  const osm = `https://www.openstreetmap.org/?mlat=${c.latitud}&mlon=${c.longitud}#map=17/${c.latitud}/${c.longitud}`;
  const publicas = c.especialidades.filter((e) => e.aceptaSolicitudesPublicas);
  const ventanilla = c.especialidades.filter((e) => !e.aceptaSolicitudesPublicas);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <PageHeader
        title={c.nombre}
        subtitle={`${TIPOS_CENTRO[c.tipo]} · ${NIVELES_ATENCION[c.nivelAtencion]} · ${c.municipio}`}
        breadcrumbs={[{ label: 'Centros de salud', to: '/centros' }, { label: c.nombre }]}
        actions={
          <>
            {selected ? (
              <Chip
                color="primary"
                variant="outlined"
                icon={<CheckCircle />}
                label="Centro seleccionado"
                sx={{ height: 40, fontWeight: 600 }}
              />
            ) : (
              <Button variant="outlined" onClick={select}>
                Seleccionar este centro
              </Button>
            )}
            <Button variant="contained" onClick={request}>
              Solicitar ficha
            </Button>
          </>
        }
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ overflow: 'hidden', mb: 3 }}>
            <CenterImage center={c} height={200} />
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <OpenStatusChip status={c.estadoApertura} size="medium" />
                {c.estadoApertura.cierre && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {c.estadoApertura.cierre.motivo} ({formatDate(c.estadoApertura.cierre.fechaInicio)})
                  </Typography>
                )}
              </Box>
              {c.descripcion && <Typography sx={{ mb: 2 }}>{c.descripcion}</Typography>}
              <Stack spacing={1.5}>
                <InfoRow icon={Place}>
                  <Typography>{c.direccion}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {c.localidad}, {c.municipio} · Provincia {c.provincia}, {c.departamento}
                  </Typography>
                </InfoRow>
                <InfoRow icon={Phone}>
                  <Link href={`tel:${c.telefono.replace(/\s/g, '')}`}>{c.telefono}</Link>
                </InfoRow>
                {c.email && (
                  <InfoRow icon={Email}>
                    <Link href={`mailto:${c.email}`}>{c.email}</Link>
                  </InfoRow>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Especialidades"
              subheader={`${c.especialidades.length} servicios en este centro`}
            />
            <CardContent sx={{ pt: 0 }}>
              {c.especialidades.length === 0 ? (
                <Typography color="text.secondary">
                  Este centro no tiene especialidades habilitadas.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    {publicas.map((e) => (
                      <Chip key={e.id} label={e.nombre} variant="outlined" />
                    ))}
                  </Stack>
                  {ventanilla.length > 0 && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Solo con ficha en ventanilla (no se solicitan por internet):
                      </Typography>
                      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                        {ventanilla.map((e) => (
                          <Chip
                            key={e.id}
                            label={e.nombre}
                            variant="outlined"
                            sx={{ borderStyle: 'dashed' }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Horario de atención" />
            <CardContent sx={{ pt: 0 }}>
              <CenterHoursTable center={c} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                El horario de cada especialidad puede ser distinto.{' '}
                <Link component={RouterLink} to="/horarios">
                  Ver horarios por especialidad
                </Link>
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              title="Ubicación"
              action={
                <Button
                  href={osm}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<Directions />}
                  size="small"
                >
                  Abrir en OpenStreetMap
                </Button>
              }
              sx={{ flexWrap: 'wrap', gap: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              {online ? (
                <Suspense fallback={<Skeleton variant="rounded" height={260} />}>
                  <CenterMap centers={[c]} selectedId={c.id} height={260} single />
                </Suspense>
              ) : (
                <MapOfflineNotice />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
