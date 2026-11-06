import { IconButton, Tooltip } from '@mui/material';
import DarkMode from '@mui/icons-material/DarkMode';
import LightMode from '@mui/icons-material/LightMode';
import { useColorMode } from '@/context/ColorModeContext';

/** Alterna claro/oscuro. La opción "según el sistema" está en Configuración. */
export default function ColorModeToggle({ sx }) {
  const { resolved, toggle } = useColorMode();
  const label = resolved === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';
  return (
    <Tooltip title={label}>
      <IconButton onClick={toggle} aria-label={label} sx={{ width: 44, height: 44, ...sx }}>
        {resolved === 'dark' ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
}
