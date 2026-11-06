import { Chip } from '@mui/material';
import HelpOutline from '@mui/icons-material/HelpOutlineOutlined';
import { STATUS_CONFIG, PUBLIC_LABELS } from './statusConfig';

/**
 * Chip de estado con tono suave accesible (contraste ≥ 4,5:1) + icono + texto.
 * `estado`: clave de STATUS_CONFIG. `publico`: usa las etiquetas para el ciudadano.
 */
export default function StatusChip({ estado, label, tone, publico = false, size = 'small', sx, ...rest }) {
  const cfg = STATUS_CONFIG[estado] || { label: estado || 'Sin estado', tone: 'neutral', Icon: HelpOutline };
  const text = label || (publico && PUBLIC_LABELS[estado]) || cfg.label;
  const Icon = cfg.Icon;
  return (
    <Chip
      size={size}
      icon={<Icon aria-hidden />}
      label={text}
      variant="outlined"
      sx={[
        (theme) => {
          const c = theme.palette.status[tone || cfg.tone] || theme.palette.status.neutral;
          return {
            bgcolor: c.bg,
            color: c.fg,
            borderColor: c.border,
            fontWeight: 600,
            maxWidth: '100%',
            '& .MuiChip-icon': { color: c.fg, ml: '6px' },
          };
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    />
  );
}
