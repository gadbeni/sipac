import { Box, Button, Typography } from '@mui/material';
import Inbox from '@mui/icons-material/Inbox';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Estado vacío con acción opcional: `action = { label, onClick }` o `{ label, to }`.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No hay información para mostrar',
  description,
  action,
  compact = false,
  sx,
}) {
  return (
    <Box
      role="status"
      sx={{ textAlign: 'center', py: compact ? 3 : 6, px: 2, color: 'text.secondary', ...sx }}
    >
      <Box
        sx={{
          width: compact ? 48 : 64,
          height: compact ? 48 : 64,
          mx: 'auto',
          mb: 2,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'subtle',
          color: 'primary.main',
        }}
      >
        <Icon sx={{ fontSize: compact ? 26 : 34 }} aria-hidden />
      </Box>
      <Typography variant={compact ? 'subtitle1' : 'h6'} component="p" color="text.primary">
        {title}
      </Typography>
      {description && <Typography sx={{ mt: 0.5, maxWidth: 440, mx: 'auto' }}>{description}</Typography>}
      {action && (
        <Button
          sx={{ mt: 2.5 }}
          variant="contained"
          {...(action.to ? { component: RouterLink, to: action.to } : { onClick: action.onClick })}
          startIcon={action.icon}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
