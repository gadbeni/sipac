import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Tooltip,
} from '@mui/material';
import Public from '@mui/icons-material/Public';
import { Link as RouterLink, matchPath, useLocation } from 'react-router-dom';
import { ADMIN_ROUTES, SIDEBAR_GROUPS } from '@/routes/routes.config';
import { sidebarIcon } from './sidebarIcons';
import BrandLogo from './BrandLogo';

export const SIDEBAR_WIDTH = 264;
export const SIDEBAR_MINI_WIDTH = 72;

const ITEMS = ADMIN_ROUTES.filter((r) => r.sidebar).sort((a, b) => a.sidebar.order - b.sidebar.order);

/** Ruta activa: coincidencia exacta para /admin y por prefijo para el resto (incluye /:id). */
const isActive = (pathname, path) =>
  path === '/admin' ? pathname === '/admin' : Boolean(matchPath({ path, end: false }, pathname));

function NavItems({ collapsed, onNavigate, canSee }) {
  const { pathname } = useLocation();
  return SIDEBAR_GROUPS.map((g) => {
    const items = ITEMS.filter((r) => r.sidebar.group === g.id && canSee(r));
    if (!items.length) return null;
    return (
      <List
        key={g.id}
        dense
        sx={{ px: 1.5, py: 0.5 }}
        subheader={
          collapsed ? (
            <Divider sx={{ my: 1 }} />
          ) : (
            <ListSubheader
              disableSticky
              sx={{
                bgcolor: 'transparent',
                lineHeight: '32px',
                px: 1.5,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {g.label}
            </ListSubheader>
          )
        }
      >
        {items.map((r) => {
          const Icon = sidebarIcon(r.sidebar.icon);
          const active = isActive(pathname, r.path);
          const button = (
            <ListItemButton
              key={r.path}
              component={RouterLink}
              to={r.path}
              selected={active}
              aria-current={active ? 'page' : undefined}
              aria-label={collapsed ? r.title : undefined}
              onClick={onNavigate}
              sx={{ mb: 0.25, justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 1.5 }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={r.title}
                  slotProps={{
                    primary: { noWrap: true, fontSize: '0.9rem', fontWeight: active ? 600 : 500 },
                  }}
                />
              )}
            </ListItemButton>
          );
          return collapsed ? (
            <Tooltip key={r.path} title={r.title} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </List>
    );
  });
}

function SidebarContent({ collapsed, onNavigate, canSee, mobile = false }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden' }}>
      {mobile ? (
        <Toolbar sx={{ minHeight: 60, borderBottom: 1, borderColor: 'divider' }}>
          <BrandLogo to="/admin" compact />
        </Toolbar>
      ) : (
        <Toolbar sx={{ minHeight: { xs: 60, md: 64 } }} />
      )}
      <Box
        component="nav"
        aria-label="Menú del panel"
        sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}
      >
        <NavItems collapsed={collapsed} onNavigate={onNavigate} canSee={canSee} />
      </Box>
      <Divider />
      <List sx={{ px: 1.5 }}>
        <Tooltip title={collapsed ? 'Ver portal público' : ''} placement="right">
          <ListItemButton
            component={RouterLink}
            to="/"
            onClick={onNavigate}
            aria-label={collapsed ? 'Ver portal público' : undefined}
            sx={{ justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
              <Public fontSize="small" />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText primary="Ver portal público" slotProps={{ primary: { fontSize: '0.9rem' } }} />
            )}
          </ListItemButton>
        </Tooltip>
      </List>
    </Box>
  );
}

/**
 * Menú lateral generado desde routes.config.js.
 *  - Escritorio (≥ 900 px): permanente, colapsable a iconos (`collapsed`).
 *  - Móvil/tablet: drawer temporal (`mobileOpen`).
 * `canSee(route)` filtra por permiso (RN-USR-01): el menú solo muestra lo permitido.
 */
export default function AdminSidebar({
  isDesktop,
  collapsed,
  mobileOpen,
  onMobileClose,
  canSee = () => true,
}) {
  if (!isDesktop) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH, maxWidth: '86vw' } } }}
      >
        <SidebarContent mobile collapsed={false} onNavigate={onMobileClose} canSee={canSee} />
      </Drawer>
    );
  }
  const width = collapsed ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH;
  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.shorter }),
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.shorter }),
        },
      }}
    >
      <SidebarContent collapsed={collapsed} canSee={canSee} />
    </Drawer>
  );
}
