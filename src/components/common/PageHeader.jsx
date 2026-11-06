import { Box, Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

/** Encabezado de página: migas de pan, título, descripción y acciones. Actualiza `document.title`. */
export default function PageHeader({ title, subtitle, breadcrumbs, actions, documentTitle, description }) {
  useDocumentMeta(documentTitle ?? title, description);

  return (
    <Box component="header" sx={{ mb: 3 }}>
      {breadcrumbs?.length > 0 && (
        <Breadcrumbs aria-label="Ruta de navegación" sx={{ mb: 1, fontSize: '0.875rem' }}>
          {breadcrumbs.map((b, i) =>
            b.to && i < breadcrumbs.length - 1 ? (
              <Link key={b.label} component={RouterLink} to={b.to} color="inherit">
                {b.label}
              </Link>
            ) : (
              <Typography key={b.label} color="text.primary" sx={{ fontSize: 'inherit' }}>
                {b.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'flex-start' } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack
            direction="row"
            sx={{
              gap: 1,
              flexWrap: 'wrap',
              flexShrink: 0,
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            }}
          >
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
