/**
 * Centro seleccionado en el portal (RN-CEN-05): persiste en `sipac:pref:publicCenter`.
 * Si el centro guardado deja de estar activo, se borra la selección y se avisa.
 * El centro de trabajo del panel (`activeCenterId`) se agrega con la sesión en la Épica 6.
 *
 * También monta el diálogo selector, que cualquier pantalla abre con `openSelector()`.
 */
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { centerService } from '@/services/centerService';
import { useDataChanged } from '@/hooks/useDataChanged';
import { useNotify } from './NotifyContext';
import { readPref, writePref } from '@/utils/preferences';

const CenterSelectorDialog = lazy(() => import('@/components/centers/CenterSelectorDialog'));
const CenterContext = createContext(null);

export function CenterProvider({ children }) {
  const notify = useNotify();
  const [centerId, setCenterId] = useState(() => readPref('publicCenter', null));
  const [center, setCenter] = useState(() => centerService.getActiveSync(readPref('publicCenter', null)));
  const [selector, setSelector] = useState({ open: false, onSelected: null });
  const warned = useRef(false);

  const sync = useCallback(() => {
    const c = centerService.getActiveSync(centerId);
    setCenter(c);
    if (centerId && !c) {
      // El centro guardado ya no está disponible (inactivo o eliminado).
      setCenterId(null);
      writePref('publicCenter', null);
      if (!warned.current) {
        warned.current = true;
        notify.warning('El centro de salud que había elegido ya no está disponible. Seleccione otro.');
      }
    }
  }, [centerId, notify]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => sync(), [sync]);
  useDataChanged(['centros'], sync);

  const selectCenter = useCallback((c) => {
    const id = typeof c === 'string' ? c : c?.id || null;
    warned.current = false;
    setCenterId(id);
    writePref('publicCenter', id);
    setCenter(centerService.getActiveSync(id));
  }, []);

  const clearCenter = useCallback(() => selectCenter(null), [selectCenter]);

  /** Abre el selector. `onSelected(center)` se ejecuta tras elegir (p. ej. continuar al asistente). */
  const openSelector = useCallback((onSelected = null) => setSelector({ open: true, onSelected }), []);

  const value = useMemo(
    () => ({ center, centerId: center?.id || null, selectCenter, clearCenter, openSelector }),
    [center, selectCenter, clearCenter, openSelector],
  );

  return (
    <CenterContext.Provider value={value}>
      {children}
      {selector.open && (
        <Suspense fallback={null}>
          <CenterSelectorDialog
            open
            currentId={center?.id || null}
            onClose={() => setSelector({ open: false, onSelected: null })}
            onSelect={(c) => {
              selectCenter(c);
              const cb = selector.onSelected;
              setSelector({ open: false, onSelected: null });
              notify.success(`Centro seleccionado: ${c.nombre}`);
              cb?.(c);
            }}
          />
        </Suspense>
      )}
    </CenterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCenter() {
  const ctx = useContext(CenterContext);
  if (!ctx) throw new Error('useCenter debe usarse dentro de CenterProvider');
  return ctx;
}
