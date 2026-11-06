/** /especialidades — especialidades del centro seleccionado con fichas disponibles. */
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Grid,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Schedule from '@mui/icons-material/Schedule';
import Category from '@mui/icons-material/Category';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import RequireCenter from '@/components/centers/RequireCenter';
import SelectedCenterBanner from '@/components/centers/SelectedCenterBanner';
import AvailabilitySummary from '@/components/portal/AvailabilitySummary';
import SpecialtyIcon from '@/components/portal/SpecialtyIcon';
import { useAsync } from '@/hooks/useAsync';
import { useRequestTicket } from '@/hooks/useRequestTicket';
import { useCenter } from '@/context/CenterContext';
import { specialtyService } from '@/services/specialtyService';
import { PORTAL_COLLECTIONS } from '@/services/portalSnapshot';
import { formatDays } from '@/services/rules/centers';

function SpecialtyCard({ e, onRequest }) {
  return (
    <Card
      component="article"
      aria-label={e.nombre}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <CardContent sx={{ flex: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
          <Box
            aria-hidden
            sx={(t) => ({
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              bgcolor: t.palette.status.primary.bg,
              color: t.palette.status.primary.fg,
            })}
          >
            <SpecialtyIcon name={e.icono} />
          </Box>
          <Typography variant="h6" component="h2" sx={{ lineHeight: 1.25 }}>
            {e.nombre}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {e.descripcion}
        </Typography>
        <AvailabilitySummary especialidad={e} />
        <Stack spacing={0.5} sx={{ mt: 2 }}>
          {e.horarios.map((h) => (
            <Stack
              key={`${h.dias.join()}-${h.horaInicio}`}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center' }}
            >
              <Schedule fontSize="small" color="action" aria-hidden />
              <Typography variant="body2">
                {formatDays(h.dias)} · {h.horaInicio} a {h.horaFin}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2 }}>
          <AvatarGroup
            max={4}
            sx={{ '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 12, fontWeight: 700 } }}
          >
            {e.medicos.map((m) => (
              <Tooltip key={m.id} title={m.nombre}>
                <Avatar
                  sx={(t) => ({ bgcolor: t.palette.status.primary.bg, color: t.palette.status.primary.fg })}
                >
                  {m.iniciales}
                </Avatar>
              </Tooltip>
            ))}
          </AvatarGroup>
          <Typography variant="body2" color="text.secondary">
            {e.medicos.length === 1 ? e.medicos[0].nombre : `${e.medicos.length} profesionales`}
          </Typography>
        </Stack>
        {e.asignacionMedico === 'automatica' && e.aceptaSolicitudesPublicas && (
          <Chip size="small" label="El establecimiento asigna el profesional" sx={{ mt: 1.5 }} />
        )}
      </CardContent>
      {e.aceptaSolicitudesPublicas && (
        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={!e.proxima}
            onClick={() => onRequest(e.codigo)}
            aria-label={`Solicitar ficha de ${e.nombre}`}
          >
            {e.proxima ? 'Solicitar ficha' : 'Sin fechas disponibles'}
          </Button>
        </CardActions>
      )}
    </Card>
  );
}

function SpecialtiesList() {
  const { centerId } = useCenter();
  const request = useRequestTicket();
  const { data, loading } = useAsync(() => specialtyService.getCenterSpecialties(centerId), [centerId], {
    watch: PORTAL_COLLECTIONS,
  });

  if (loading) {
    return (
      <Grid container spacing={2}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
        ))}
      </Grid>
    );
  }
  if (!data?.length) {
    return (
      <EmptyState
        icon={Category}
        title="Este centro no tiene especialidades con horario de atención"
        sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
      />
    );
  }
  return (
    <Grid container spacing={2}>
      {data.map((e) => (
        <Grid key={e.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <SpecialtyCard e={e} onRequest={request} />
        </Grid>
      ))}
    </Grid>
  );
}

export default function SpecialtiesPage() {
  const { center } = useCenter();
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <PageHeader
        title="Especialidades"
        subtitle={
          center
            ? `Servicios de ${center.nombre} y fichas disponibles por internet.`
            : 'Elija un centro para ver sus especialidades.'
        }
        description="Especialidades del centro de salud, horarios de atención y fichas disponibles por internet."
      />
      {center && (
        <Box sx={{ mb: 3 }}>
          <SelectedCenterBanner />
        </Box>
      )}
      <RequireCenter>
        <SpecialtiesList />
      </RequireCenter>
    </Container>
  );
}
