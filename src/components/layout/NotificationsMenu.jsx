/** Campana de notificaciones del panel: contador, lista, marcar leídas y enlace. */
import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Notifications from '@mui/icons-material/Notifications';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { notificationService } from '@/services/notificationService';
import { formatRelative } from '@/utils/dates';

export default function NotificationsMenu() {
  const { session } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const { data } = useAsync(
    () => notificationService.list(session),
    [session?.usuarioId, session?.activeCenterId],
    { watch: ['notificaciones'], initial: [] },
  );
  const items = data || [];
  const unread = items.filter((n) => !n.leida).length;
  const label = unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones';

  const open = async (n) => {
    setAnchor(null);
    try {
      if (!n.leida) await notificationService.markRead(session, n.id);
    } catch (e) {
      notify.error(e);
    }
    if (n.enlace) navigate(n.enlace);
  };

  const markAll = async () => {
    try {
      const k = await notificationService.markAllRead(session);
      if (k) notify.success('Notificaciones marcadas como leídas.');
    } catch (e) {
      notify.error(e);
    }
  };

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={label}
          aria-haspopup="dialog"
          sx={{ width: 44, height: 44 }}
        >
          <Badge badgeContent={unread} color="error" max={99}>
            {unread ? <Notifications /> : <NotificationsNone />}
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: 'min(380px, calc(100vw - 24px))', mt: 1 },
            role: 'dialog',
            'aria-label': 'Notificaciones',
          },
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25 }}
        >
          <Typography sx={{ fontWeight: 700 }}>Notificaciones</Typography>
          <Button size="small" onClick={markAll} disabled={!unread}>
            Marcar todas como leídas
          </Button>
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            No hay notificaciones.
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {items.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => open(n)}
                sx={{
                  alignItems: 'flex-start',
                  gap: 1,
                  py: 1.25,
                  borderRadius: 0,
                  bgcolor: n.leida ? 'transparent' : 'action.selected',
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    mt: 1,
                    flexShrink: 0,
                    bgcolor: n.leida ? 'transparent' : 'primary.main',
                  }}
                />
                <ListItemText
                  primary={
                    <>
                      {n.titulo}
                      {!n.leida && <span style={{ position: 'absolute', left: -9999 }}> (sin leer)</span>}
                    </>
                  }
                  secondary={
                    <>
                      {n.mensaje}
                      <Typography component="span" variant="caption" sx={{ display: 'block', mt: 0.25 }}>
                        {formatRelative(n.creadoEn)}
                        {n.centro && !session.activeCenterId ? ` · ${n.centro}` : ''}
                      </Typography>
                    </>
                  }
                  slotProps={{ primary: { sx: { fontWeight: n.leida ? 500 : 700 } } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
