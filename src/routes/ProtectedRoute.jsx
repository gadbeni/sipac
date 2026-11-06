import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import ForbiddenPage from '@/pages/ForbiddenPage';

/** Exige sesión; si no hay, va a /login conservando la ruta de destino (y avisa si expiró). */
export function RequireAuth({ children }) {
  const { session, expired, loggedOut } = useAuth();
  const location = useLocation();
  if (!session) {
    if (loggedOut) return <Navigate to="/login" replace />;
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}${expired ? '&expirada=1' : ''}`} replace />;
  }
  return children;
}

/** Exige el permiso de la ruta; si falta muestra 403 (no la pantalla). */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  return can(permission) ? children : <ForbiddenPage />;
}
