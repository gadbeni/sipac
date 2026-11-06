/**
 * Estado de conexión para la interfaz. Combina `navigator.onLine` con una simulación
 * manual (Configuración → "Simular sin conexión") que la capa de datos también respeta
 * (setOnlineOverride), de modo que las escrituras se bloquean igual que sin red real (RN-OFF-01).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setOnlineOverride } from '@/services/datasource/connectivity';

const ConnectivityContext = createContext(null);
const navOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export function ConnectivityProvider({ children }) {
  const [networkOnline, setNetworkOnline] = useState(navOnline);
  const [simulatedOffline, setSimulatedOffline] = useState(false);

  useEffect(() => {
    const up = () => setNetworkOnline(true);
    const down = () => setNetworkOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const setSimulated = useCallback((value) => {
    setSimulatedOffline(value);
    setOnlineOverride(value ? false : null);
  }, []);

  const value = useMemo(
    () => ({
      online: networkOnline && !simulatedOffline,
      networkOnline,
      simulatedOffline,
      setSimulatedOffline: setSimulated,
    }),
    [networkOnline, simulatedOffline, setSimulated],
  );
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConnectivity() {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error('useConnectivity debe usarse dentro de ConnectivityProvider');
  return ctx;
}
