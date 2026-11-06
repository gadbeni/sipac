import Block from '@mui/icons-material/Block';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';

/** 403: la ruta existe pero el usuario no tiene permiso (RN-USR-01). */
export default function ForbiddenPage() {
  return (
    <>
      <PageHeader title="Acceso no permitido" documentTitle="Acceso no permitido (403)" />
      <EmptyState
        icon={Block}
        title="No tiene permiso para ver esta sección"
        description="Su rol no incluye esta opción. Si cree que es un error, comuníquese con la administración central. (Error 403)"
        action={{ label: 'Ir al dashboard', to: '/admin' }}
        sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
      />
    </>
  );
}
