import { Chip, Tooltip } from '@mui/material';
import Science from '@mui/icons-material/Science';
import { appConfig } from '@/config/app.config';

/** Distintivo permanente de prototipo: el sistema no debe confundirse con uno oficial (D-01). */
export default function DemoBadge({ sx }) {
  if (!appConfig.demo.enabled) return null;
  return (
    <Tooltip title={appConfig.demo.notice}>
      <Chip
        size="small"
        icon={<Science aria-hidden />}
        label="Demo"
        tabIndex={0}
        aria-label={`Demostración. ${appConfig.demo.notice}`}
        sx={[
          (t) => ({
            bgcolor: t.palette.status.warning.bg,
            color: t.palette.status.warning.fg,
            border: `1px solid ${t.palette.status.warning.border}`,
            fontWeight: 700,
            '& .MuiChip-icon': { color: t.palette.status.warning.fg },
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
    </Tooltip>
  );
}
