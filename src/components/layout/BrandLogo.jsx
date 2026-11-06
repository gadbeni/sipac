import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { appConfig } from '@/config/app.config';

/** Logo + nombre del sistema (configurable en app.config.js). `compact` oculta la institución. */
export default function BrandLogo({ to = '/', compact = false, hideTextOnXs = false }) {
  return (
    <Stack
      component={RouterLink}
      to={to}
      direction="row"
      spacing={1.25}
      aria-label={`${appConfig.appName} — ir al inicio`}
      sx={{
        alignItems: 'center',
        color: 'inherit',
        textDecoration: 'none',
        minWidth: 0,
        borderRadius: 1,
        '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <Box
        component="img"
        src={appConfig.branding.logo}
        alt=""
        width={36}
        height={36}
        sx={{ flexShrink: 0, borderRadius: '9px' }}
      />
      <Box sx={{ minWidth: 0, display: hideTextOnXs ? { xs: 'none', sm: 'block' } : 'block' }}>
        <Typography
          component="span"
          sx={{
            display: 'block',
            fontWeight: 800,
            fontSize: '1.125rem',
            lineHeight: 1.1,
            letterSpacing: '0.02em',
          }}
        >
          {appConfig.appName}
        </Typography>
        {!compact && (
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: { xs: 'none', md: 'block' }, lineHeight: 1.2 }}
          >
            {appConfig.institution.name}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
