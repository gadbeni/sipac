import { Box, ThemeProvider } from '@mui/material';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PageLoading from '@/components/layout/PageLoading';
import OfflineBanner from '@/components/layout/OfflineBanner';
import { displayTheme } from '@/theme/displayTheme';

/** Pantalla de llamado (TV): sin navegación, ocupa toda la ventana, tema oscuro de alto contraste. */
export default function DisplayLayout() {
  const { pathname } = useLocation();
  return (
    <ThemeProvider theme={displayTheme}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        <OfflineBanner />
        <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
