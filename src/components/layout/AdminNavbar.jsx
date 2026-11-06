import { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpen from '@mui/icons-material/MenuOpen';
import Person from '@mui/icons-material/Person';
import Key from '@mui/icons-material/Key';
import Settings from '@mui/icons-material/Settings';
import Public from '@mui/icons-material/Public';
import Logout from '@mui/icons-material/Logout';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import ColorModeToggle from './ColorModeToggle';
import CenterSwitcher from './CenterSwitcher';
import NotificationsMenu from './NotificationsMenu';
import DemoBadge from '@/components/common/DemoBadge';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';

const initialsOf = (name) =>
  name
    .replace(/\(.*?\)/g, '')
    .replace(/^(Dra?\.)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Barra superior del panel: menú lateral, centro de trabajo, modo de color y cuenta. */
export default function AdminNavbar({ isDesktop, collapsed, onMenuClick }) {
  const { session, logout } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const name = session?.nombre || '';
  const close = () => setAnchor(null);
  const menuLabel = isDesktop
    ? collapsed
      ? 'Expandir menú lateral'
      : 'Contraer menú lateral'
    : 'Abrir menú';

  const onLogout = () => {
    close();
    logout();
    notify.info('Sesión cerrada.');
    navigate('/login', { replace: true });
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: (t) => (isDesktop ? t.zIndex.drawer + 1 : t.zIndex.appBar) }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 60, md: 64 }, px: { xs: 1, sm: 2 } }}>
        <Tooltip title={menuLabel}>
          <IconButton onClick={onMenuClick} aria-label={menuLabel} sx={{ width: 44, height: 44 }}>
            {isDesktop && !collapsed ? <MenuOpen /> : <MenuIcon />}
          </IconButton>
        </Tooltip>
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
          <BrandLogo to="/admin" compact />
          <DemoBadge sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <CenterSwitcher />
        <NotificationsMenu />
        <ColorModeToggle />
        <Tooltip title="Cuenta">
          <IconButton
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="Abrir menú de la cuenta"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            sx={{ p: 0.5 }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontSize: '0.9rem',
                fontWeight: 700,
              }}
            >
              {initialsOf(name) || '?'}
            </Avatar>
          </IconButton>
        </Tooltip>
      </Toolbar>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 250, mt: 1 } } }}
      >
        <Stack sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {session?.rolLabel} · <code>{session?.username}</code>
          </Typography>
        </Stack>
        <Divider />
        <MenuItem component={RouterLink} to="/admin/perfil" onClick={close}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          Mi perfil
        </MenuItem>
        <MenuItem component={RouterLink} to="/admin/perfil#contrasena" onClick={close}>
          <ListItemIcon>
            <Key fontSize="small" />
          </ListItemIcon>
          Cambiar contraseña
        </MenuItem>
        <MenuItem component={RouterLink} to="/admin/configuracion" onClick={close}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Configuración
        </MenuItem>
        <MenuItem component={RouterLink} to="/" onClick={close}>
          <ListItemIcon>
            <Public fontSize="small" />
          </ListItemIcon>
          Ver portal público
        </MenuItem>
        <Divider />
        <MenuItem onClick={onLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Cerrar sesión
        </MenuItem>
      </Menu>
    </AppBar>
  );
}
