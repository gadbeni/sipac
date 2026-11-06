import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import LocalHospital from '@mui/icons-material/LocalHospital';
import Place from '@mui/icons-material/Place';
import { Link as RouterLink } from 'react-router-dom';
import OpenStatusChip from './OpenStatusChip';
import { useCenter } from '@/context/CenterContext';
import { openStatus } from '@/services/rules/centers';
import { currentTime, today } from '@/utils/dates';

/**
 * Tarjeta destacada con el centro elegido (o invitación a elegir uno).
 * `action` permite agregar un botón principal (p. ej. "Solicitar ficha").
 */
export default function SelectedCenterBanner({ action, title = 'Su centro de salud' }) {
  const { center, openSelector } = useCenter();

  if (!center) {
    return (
      <Card sx={{ borderStyle: 'dashed' }}>
        <CardContent
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: { sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box
            aria-hidden
            sx={(t) => ({
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: t.palette.status.primary.bg,
              color: t.palette.status.primary.fg,
              flexShrink: 0,
            })}
          >
            <LocalHospital />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h2">
              Seleccione un centro de salud
            </Typography>
            <Typography color="text.secondary">
              Verá especialidades, médicos y horarios del centro que elija.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={() => openSelector()}>
              Elegir centro
            </Button>
            <Button component={RouterLink} to="/centros">
              Ver mapa
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const status = openStatus(center, today(), currentTime());
  return (
    <Card sx={{ borderColor: 'primary.main' }}>
      <CardContent
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: { sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          <LocalHospital />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h6" component="h2" sx={{ lineHeight: 1.3 }}>
            {center.nombre}
          </Typography>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <Place fontSize="inherit" aria-hidden /> {center.direccion}, {center.municipio}
            </Typography>
            <OpenStatusChip status={status} />
          </Stack>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          {action}
          <Button component={RouterLink} to={`/centros/${center.codigoCorto}`}>
            Ver centro
          </Button>
          <Button onClick={() => openSelector()} color="inherit">
            Cambiar
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
