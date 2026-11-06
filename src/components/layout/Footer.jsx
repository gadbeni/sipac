import { Box, Container, Divider, Grid, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { appConfig } from '@/config/app.config';

const LINKS = [
  { to: '/centros', label: 'Centros de salud' },
  { to: '/solicitar-ficha', label: 'Solicitar ficha' },
  { to: '/consultar', label: 'Consultar solicitud' },
  { to: '/login', label: 'Ingreso del personal' },
];

export default function Footer() {
  const { institution, appName, appFullName, demo } = appConfig;
  return (
    <Box
      component="footer"
      sx={{ mt: 'auto', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography sx={{ fontWeight: 800 }}>{appName}</Typography>
            <Typography variant="body2" color="text.secondary">
              {appFullName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {institution.name} · {institution.department}, {institution.country}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
              Accesos
            </Typography>
            <Stack spacing={0.75}>
              {LINKS.map((l) => (
                <Link key={l.to} component={RouterLink} to={l.to} color="text.secondary" variant="body2">
                  {l.label}
                </Link>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
              Contacto
            </Typography>
            <Stack spacing={0.75}>
              <Link
                href={`tel:${institution.phone.replace(/\s/g, '')}`}
                color="text.secondary"
                variant="body2"
              >
                {institution.phone}
              </Link>
              <Link
                href={`mailto:${institution.email}`}
                color="text.secondary"
                variant="body2"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {institution.email}
              </Link>
            </Stack>
          </Grid>
        </Grid>
        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary" component="p">
          {demo.enabled ? demo.notice : `© ${new Date().getFullYear()} ${institution.name}`}
        </Typography>
      </Container>
    </Box>
  );
}
