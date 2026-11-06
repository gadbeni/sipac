/**
 * Sesión del personal (simulada). Expone `session`, `login`, `logout`, `setActiveCenter` y `can`.
 * Revisa la expiración periódicamente, al volver a la pestaña y ante cambios desde otra pestaña.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService, SESSION_KEY } from '@/services/authService';
import { can as canPerm } from '@/services/auth/guards';
import { useDataChanged } from '@/hooks/useDataChanged';

const AuthContext = createContext(null);

const read = () => {
  const s = authService.getSession();
  return s?.expired ? { session: null, expired: true } : { session: s, expired: false };
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(read);

  const refresh = useCallback(() => {
    setState((prev) => {
      const next = read();
      // Mantiene "expired" si la sesión anterior existía y ya no es válida por tiempo.
      if (!next.session && prev.session && next.expired) return next;
      if (JSON.stringify(next.session) === JSON.stringify(prev.session)) return prev;
      return {
        session: next.session,
        expired: next.expired || (prev.session && !next.session ? prev.expired : false),
      };
    });
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    const onStorage = (e) => e.key === SESSION_KEY && refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  // Usuario desactivado o centros modificados → se revalida la sesión.
  useDataChanged(['usuarios', 'medicoCentros', 'centros'], refresh);

  const login = useCallback(async (username, password) => {
    const s = await authService.login(username, password);
    setState({ session: s, expired: false });
    return s;
  }, []);

  /** Cierre voluntario: `loggedOut` evita conservar la ruta actual como destino del próximo ingreso. */
  const logout = useCallback(() => {
    authService.logout();
    setState({ session: null, expired: false, loggedOut: true });
  }, []);

  const setActiveCenter = useCallback(
    (centroId) => {
      const s = authService.setActiveCenter(state.session, centroId);
      setState({ session: s, expired: false });
      return s;
    },
    [state.session],
  );

  const can = useCallback((p) => !p || canPerm(state.session, p), [state.session]);

  const value = useMemo(
    () => ({
      session: state.session,
      expired: state.expired,
      loggedOut: Boolean(state.loggedOut),
      login,
      logout,
      setActiveCenter,
      can,
      refresh,
    }),
    [state, login, logout, setActiveCenter, can, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
