import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  useMediaQuery,
} from '@mui/material';

/**
 * Diálogo de confirmación. `onConfirm` puede ser asíncrona: se muestra el progreso y no
 * se cierra hasta que termine. `children` permite agregar campos (p. ej. motivo).
 */
export default function ConfirmDialog({
  open,
  title = '¿Confirmar la acción?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
  children,
}) {
  const [busy, setBusy] = useState(false);
  const fullScreen = useMediaQuery((t) => t.breakpoints.down('sm'));

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen && Boolean(children)}
      aria-labelledby="confirm-dialog-title"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      {(message || children) && (
        <DialogContent>
          {message && <DialogContentText sx={{ mb: children ? 2 : 0 }}>{message}</DialogContentText>}
          {children}
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} color="inherit">
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={busy || confirmDisabled}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          autoFocus={!children}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
