import { Box, CircularProgress } from '@mui/material';

/** Indicador mientras se descarga una página diferida. */
export default function PageLoading() {
  return (
    <Box
      sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}
      role="status"
      aria-label="Cargando"
    >
      <CircularProgress />
    </Box>
  );
}
