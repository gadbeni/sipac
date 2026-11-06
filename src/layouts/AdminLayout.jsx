import { useState } from 'react';
import { Box, GlobalStyles, Toolbar, useMediaQuery } from '@mui/material';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PageLoading from '@/components/layout/PageLoading';
import AdminNavbar from '@/components/layout/AdminNavbar';
import AdminSidebar from '@/components/layout/AdminSidebar';
import OfflineBanner from '@/components/layout/OfflineBanner';
import SkipLink from '@/components/layout/SkipLink';
import { readPref, writePref } from '@/utils/preferences';
import { useAuth } from '@/context/AuthContext';

/** Impresión (Reportes, comprobantes): sin navegación, fondo blanco, márgenes A4/Carta. */
const PRINT_STYLES = {
  '.sipac-print-only': { display: 'none' },
  '@media print': {
    '@page': { size: 'auto', margin: '12mm' },
    'html, body': { background: '#fff !important' },
    '.sipac-no-print': { display: 'none !important' },
    '.sipac-print-only': { display: 'block' },
    '.sipac-avoid-break': { breakInside: 'avoid' },
    '.sipac-report .MuiCardHeader-action': { display: 'none' },
    '.sipac-report .MuiCard-root': { boxShadow: 'none !important', border: '1px solid #CBD5E1' },
    '#contenido': { padding: '0 !important', maxWidth: 'none !important' },
    '.sipac-report': { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' },
    '.sipac-report .MuiTableContainer-root': { overflow: 'visible !important' },
    '.sipac-report .MuiTableCell-root': {
      padding: '4px 6px !important',
      fontSize: '10.5px !important',
      whiteSpace: 'normal !important',
    },
  },
};

/** Panel administrativo: navbar fija + sidebar (colapsable ≥ 900 px, drawer temporal < 900 px). */
export default function AdminLayout() {
  const { pathname } = useLocation();
  const { can } = useAuth();
  const isDesktop = useMediaQuery((t) => t.breakpoints.up('md'), { noSsr: true });
  const [collapsed, setCollapsed] = useState(() => readPref('sidebarCollapsed', false) === true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const onMenuClick = () => {
    if (!isDesktop) return setMobileOpen(true);
    setCollapsed((c) => {
      writePref('sidebarCollapsed', !c);
      return !c;
    });
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <GlobalStyles styles={PRINT_STYLES} />
      <Box className="sipac-no-print" sx={{ display: 'contents' }}>
        <SkipLink />
        <AdminNavbar isDesktop={isDesktop} collapsed={collapsed} onMenuClick={onMenuClick} />
        <AdminSidebar
          isDesktop={isDesktop}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          canSee={(r) => can(r.permission)}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Toolbar className="sipac-no-print" sx={{ minHeight: { xs: 60, md: 64 } }} />
        <Box className="sipac-no-print">
          <OfflineBanner />
        </Box>
        <Box
          component="main"
          id="contenido"
          tabIndex={-1}
          sx={{ flex: 1, p: { xs: 2, sm: 3 }, outline: 'none', maxWidth: 1440, width: '100%', mx: 'auto' }}
        >
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
}
