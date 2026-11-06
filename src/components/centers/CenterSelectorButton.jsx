import { Button, Tooltip } from '@mui/material';
import LocalHospital from '@mui/icons-material/LocalHospital';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useCenter } from '@/context/CenterContext';

/** Botón del encabezado: muestra el centro elegido y abre el selector. */
export default function CenterSelectorButton({ fullWidth = false, sx }) {
  const { center, openSelector } = useCenter();
  const label = center ? center.nombre : 'Elegir centro de salud';
  return (
    <Tooltip title={center ? 'Cambiar de centro de salud' : ''}>
      <Button
        onClick={() => openSelector()}
        variant={center ? 'outlined' : 'contained'}
        color={center ? 'inherit' : 'secondary'}
        startIcon={<LocalHospital />}
        endIcon={<ExpandMore />}
        fullWidth={fullWidth}
        aria-label={
          center ? `Centro seleccionado: ${center.nombre}. Cambiar centro` : 'Elegir centro de salud'
        }
        sx={{
          justifyContent: 'flex-start',
          minWidth: 0,
          borderColor: 'divider',
          ...(center && { bgcolor: 'background.paper' }),
          '& .label': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'left',
          },
          ...sx,
        }}
      >
        <span className="label">{label}</span>
      </Button>
    </Tooltip>
  );
}
