import { Container } from '@mui/material';
import TravelExplore from '@mui/icons-material/TravelExplore';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';

export default function NotFoundPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      <PageHeader title="Página no encontrada" documentTitle="Página no encontrada" />
      <EmptyState
        icon={TravelExplore}
        title="No encontramos la página solicitada"
        description="Es posible que la dirección esté mal escrita o que la página ya no exista."
        action={{ label: 'Volver al inicio', to: '/' }}
        sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
      />
    </Container>
  );
}
