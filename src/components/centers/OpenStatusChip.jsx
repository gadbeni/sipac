import { Chip } from '@mui/material';
import AccessTime from '@mui/icons-material/AccessTime';
import { openStatusLabel } from '@/services/rules/centers';

/** "Abierto · cierra 19:00" / "Cerrado · abre 07:00" con tono accesible. */
export default function OpenStatusChip({ status, size = 'small' }) {
  if (!status) return null;
  const { label, tone } = openStatusLabel(status);
  return (
    <Chip
      size={size}
      icon={<AccessTime aria-hidden />}
      label={label}
      variant="outlined"
      sx={(t) => {
        const c = t.palette.status[tone];
        return {
          bgcolor: c.bg,
          color: c.fg,
          borderColor: c.border,
          fontWeight: 600,
          '& .MuiChip-icon': { color: c.fg },
        };
      }}
    />
  );
}
