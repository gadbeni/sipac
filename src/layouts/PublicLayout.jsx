import { Box } from '@mui/material';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PageLoading from '@/components/layout/PageLoading';
import PublicHeader from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';
import OfflineBanner from '@/components/layout/OfflineBanner';
import SkipLink from '@/components/layout/SkipLink';

/** Portal ciudadano: encabezado, aviso sin conexión, contenido y pie. */
export default function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <SkipLink />
      <PublicHeader />
      <OfflineBanner />
      <Box component="main" id="contenido" tabIndex={-1} sx={{ flex: 1, outline: 'none', minWidth: 0 }}>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </Box>
      <Footer />
    </Box>
  );
}
