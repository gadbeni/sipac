/**
 * Notificaciones breves (Snackbar único con cola).
 *   const notify = useNotify(); notify.success('Ficha emitida'); notify.error(err);
 * `error` acepta un AppError y muestra su mensaje en español.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Alert, Snackbar, useMediaQuery } from '@mui/material';
import { isAppError, ERROR_MESSAGES } from '@/services/errors';

const NotifyContext = createContext(null);

const toMessage = (m) => {
  if (typeof m === 'string') return m;
  if (isAppError(m)) return m.message || ERROR_MESSAGES[m.code] || 'Ocurrió un error.';
  if (m instanceof Error) return 'Ocurrió un error inesperado. Intente nuevamente.';
  return String(m ?? '');
};

export function NotifyProvider({ children }) {
  const queue = useRef([]);
  const currentRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery((t) => t.breakpoints.down('sm'));

  const showNext = useCallback(() => {
    const next = queue.current.shift() || null;
    currentRef.current = next;
    setCurrent(next);
    setOpen(Boolean(next));
  }, []);

  const push = useCallback(
    (severity, message, opts = {}) => {
      if (severity === 'error' && message instanceof Error && !isAppError(message)) console.error(message);
      queue.current.push({
        key: `${Date.now()}-${Math.random()}`,
        severity,
        message: toMessage(message),
        ...opts,
      });
      // Si hay un mensaje visible se cierra; al terminar su salida (onExited) se muestra el siguiente.
      if (!currentRef.current) showNext();
      else setOpen(false);
    },
    [showNext],
  );

  const notify = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      warning: (m, o) => push('warning', m, o),
    }),
    [push],
  );

  const handleClose = (_e, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        key={current?.key}
        open={open && Boolean(current)}
        autoHideDuration={current?.severity === 'error' ? 7000 : 4000}
        onClose={handleClose}
        slotProps={{ transition: { onExited: showNext } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'left' }}
      >
        {current ? (
          <Alert
            onClose={handleClose}
            severity={current.severity}
            variant="filled"
            sx={{ width: '100%', maxWidth: 480 }}
          >
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error('useNotify debe usarse dentro de NotifyProvider');
  return ctx;
}
