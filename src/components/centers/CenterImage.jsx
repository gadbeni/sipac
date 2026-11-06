import { useState } from 'react';
import { Box } from '@mui/material';
import LocalHospital from '@mui/icons-material/LocalHospital';

/** Imagen del centro con alternativa si no tiene o no carga (ilustraciones genéricas, no fotos reales). */
export default function CenterImage({ center, height = 140, sx }) {
  const [failed, setFailed] = useState(false);
  if (!center?.imagen || failed) {
    return (
      <Box
        aria-hidden
        sx={{
          height,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'subtle',
          color: 'primary.main',
          ...sx,
        }}
      >
        <LocalHospital sx={{ fontSize: 48 }} />
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={center.imagen}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      sx={{ display: 'block', width: '100%', height, objectFit: 'cover', ...sx }}
    />
  );
}
