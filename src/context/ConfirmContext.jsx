/**
 * Confirmación modal basada en promesas:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: '¿Cancelar la ficha?', confirmLabel: 'Cancelar ficha', destructive: true })) …
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, options: {} });
  const resolver = useRef(null);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setState({ open: true, options });
      }),
    [],
  );

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState((s) => ({ ...s, open: false }));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        {...state.options}
        open={state.open}
        onConfirm={() => close(true)}
        onClose={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  return ctx;
}
