import { Box, Container } from '@mui/material';
import Construction from '@mui/icons-material/Construction';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import SelectedCenterBanner from '@/components/centers/SelectedCenterBanner';

/** Acción útil según la ruta (sin enlaces a la misma página). */
function placeholderAction(route, area) {
  if (area === 'admin')
    return route.path === '/admin' ? undefined : { label: 'Ir al dashboard', to: '/admin' };
  return route.path === '/'
    ? { label: 'Ver centros de salud', to: '/centros' }
    : { label: 'Volver al inicio', to: '/' };
}

/** Pantalla provisional dentro del layout correspondiente. Se reemplaza en la épica indicada. */
export default function PlaceholderPage({ route, area = 'public' }) {
  const body = (
    <>
      <PageHeader
        title={route.title}
        breadcrumbs={
          area === 'admin' && route.path !== '/admin'
            ? [{ label: 'Panel', to: '/admin' }, { label: route.title }]
            : undefined
        }
      />
      {route.requiresCenter && (
        <Box sx={{ mb: 3 }}>
          <SelectedCenterBanner />
        </Box>
      )}
      <EmptyState
        icon={Construction}
        title="Pantalla en construcción"
        description={`Esta sección se implementa en la Épica ${route.epic} del roadmap.`}
        action={placeholderAction(route, area)}
        sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
      />
    </>
  );
  if (area === 'admin') return body;
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      {body}
    </Container>
  );
}
