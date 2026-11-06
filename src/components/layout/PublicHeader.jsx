import { useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Close from '@mui/icons-material/Close';
import Login from '@mui/icons-material/Login';
import { NavLink, Link as RouterLink, useLocation } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import ColorModeToggle from './ColorModeToggle';
import DemoBadge from '@/components/common/DemoBadge';
import CenterSelectorButton from '@/components/centers/CenterSelectorButton';
import { PUBLIC_ROUTES } from '@/routes/routes.config';
import { useRequestTicket } from '@/hooks/useRequestTicket';
import { useAuth } from '@/context/AuthContext';

const NAV = PUBLIC_ROUTES.filter((r) => r.menu);
const isActive = (pathname, path) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

/** Encabezado del portal: logo, menú, "Solicitar ficha", modo oscuro e ingreso del personal. */
export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const close = () => setOpen(false);
  const request = useRequestTicket();
  const { session } = useAuth();

  return (
    <AppBar position="sticky">
      <Container maxWidth="lg" disableGutters>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 60, md: 68 }, px: { xs: 1.5, sm: 2 } }}>
          <BrandLogo />
          <DemoBadge sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
          <Box
            component="nav"
            aria-label="Menú principal"
            sx={{ display: { xs: 'none', lg: 'flex' }, ml: 1, gap: 0.25 }}
          >
            {NAV.map((r) => (
              <Button
                key={r.path}
                component={NavLink}
                to={r.path}
                end={r.path === '/'}
                color="inherit"
                sx={{
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  px: 1.25,
                  '&.active': { color: 'primary.main', bgcolor: 'action.selected' },
                }}
              >
                {r.navLabel || r.title}
              </Button>
            ))}
          </Box>
          <Box sx={{ flex: 1 }} />
          <ColorModeToggle />
          <Button
            component={RouterLink}
            to={session ? '/admin' : '/login'}
            color="inherit"
            startIcon={<Login />}
            sx={{ display: { xs: 'none', md: 'inline-flex' }, whiteSpace: 'nowrap' }}
          >
            {session ? 'Mi panel' : 'Ingresar'}
          </Button>
          <Button
            onClick={() => request()}
            variant="contained"
            sx={{ display: { xs: 'none', sm: 'inline-flex' }, whiteSpace: 'nowrap' }}
          >
            Solicitar ficha
          </Button>
          <IconButton
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            aria-controls="public-menu"
            aria-expanded={open}
            sx={{ display: { lg: 'none' }, width: 44, height: 44 }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>
      {/* Centro seleccionado: visible en todas las pantallas del portal (RN-CEN-05). */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'subtle' }}>
        <Container
          maxWidth="lg"
          sx={{ py: 0.75, px: { xs: 1.5, sm: 2 }, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}
          >
            Centro de salud:
          </Typography>
          <CenterSelectorButton sx={{ minHeight: 36, maxWidth: { xs: '100%', sm: 420 } }} />
        </Container>
      </Box>

      <Drawer
        anchor="right"
        open={open}
        onClose={close}
        id="public-menu"
        slotProps={{ paper: { sx: { width: 'min(320px, 86vw)' } } }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', p: 1.5, pl: 2 }}>
          <BrandLogo compact />
          <IconButton onClick={close} aria-label="Cerrar menú" sx={{ width: 44, height: 44 }}>
            <Close />
          </IconButton>
        </Stack>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => {
              close();
              request();
            }}
          >
            Solicitar ficha
          </Button>
        </Box>
        <List component="nav" aria-label="Menú principal" sx={{ px: 1 }}>
          {NAV.map((r) => (
            <ListItemButton
              key={r.path}
              component={RouterLink}
              to={r.path}
              selected={isActive(pathname, r.path)}
              onClick={close}
            >
              <ListItemText primary={r.title} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ my: 1 }} />
        <List sx={{ px: 1 }}>
          <ListItemButton component={RouterLink} to={session ? '/admin' : '/login'} onClick={close}>
            <ListItemText primary={session ? 'Ir al panel' : 'Ingreso del personal'} />
          </ListItemButton>
        </List>
        <Box sx={{ p: 2, mt: 'auto' }}>
          <DemoBadge />
        </Box>
      </Drawer>
    </AppBar>
  );
}
