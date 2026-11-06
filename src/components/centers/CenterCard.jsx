import { Box, Button, Card, CardActions, CardContent, Chip, Link, Stack, Typography } from '@mui/material';
import Place from '@mui/icons-material/Place';
import Phone from '@mui/icons-material/Phone';
import NearMe from '@mui/icons-material/NearMe';
import CheckCircle from '@mui/icons-material/CheckCircle';
import { Link as RouterLink } from 'react-router-dom';
import CenterImage from './CenterImage';
import OpenStatusChip from './OpenStatusChip';
import { TIPOS_CENTRO } from '@/config/constants';
import { formatDistance } from '@/utils/geo';

/** Tarjeta de centro para el catálogo y el selector. */
export default function CenterCard({
  center,
  selected = false,
  onSelect,
  showImage = true,
  headingLevel = 'h2',
}) {
  return (
    <Card
      component="article"
      aria-label={center.nombre}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...(selected && {
          borderColor: 'primary.main',
          boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}`,
        }),
      }}
    >
      {showImage && <CenterImage center={center} />}
      <CardContent sx={{ flex: 1 }}>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Chip size="small" label={TIPOS_CENTRO[center.tipo]} />
          <OpenStatusChip status={center.estadoApertura} />
        </Stack>
        <Typography variant="h6" component={headingLevel} sx={{ lineHeight: 1.3 }}>
          {center.nombre}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {center.municipio} · {center.codigoCorto}
        </Typography>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Place fontSize="small" color="action" aria-hidden sx={{ mt: '2px' }} />
            <Typography variant="body2">{center.direccion}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Phone fontSize="small" color="action" aria-hidden />
            <Link href={`tel:${center.telefono.replace(/\s/g, '')}`} variant="body2">
              {center.telefono}
            </Link>
          </Stack>
          {center.distanciaKm != null && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <NearMe fontSize="small" color="action" aria-hidden />
              <Typography variant="body2">
                A {formatDistance(center.distanciaKm)} de su ubicación (en línea recta)
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1, flexWrap: 'wrap' }}>
        {onSelect &&
          (selected ? (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'primary.main',
                fontWeight: 600,
                minHeight: 40,
                mr: 'auto',
              }}
            >
              <CheckCircle fontSize="small" aria-hidden /> Centro seleccionado
            </Box>
          ) : (
            <Button
              variant="contained"
              onClick={() => onSelect(center)}
              aria-label={`Seleccionar ${center.nombre}`}
            >
              Seleccionar
            </Button>
          ))}
        <Button
          component={RouterLink}
          to={`/centros/${center.codigoCorto}`}
          aria-label={`Ver detalle de ${center.nombre}`}
          sx={{ ml: '0 !important' }}
        >
          Ver detalle
        </Button>
      </CardActions>
    </Card>
  );
}
