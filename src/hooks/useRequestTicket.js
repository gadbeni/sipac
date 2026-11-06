import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCenter } from '@/context/CenterContext';

/**
 * Acción "Solicitar ficha": sin centro elegido abre primero el selector y luego continúa
 * al asistente (CA Épica 4). `especialidad` (código, p. ej. 'MG') preselecciona en el asistente.
 */
export function useRequestTicket() {
  const { center, openSelector } = useCenter();
  const navigate = useNavigate();
  return useCallback(
    (especialidad) => {
      const to = especialidad
        ? `/solicitar-ficha?especialidad=${encodeURIComponent(especialidad)}`
        : '/solicitar-ficha';
      if (center) navigate(to);
      else openSelector(() => navigate(to));
    },
    [center, openSelector, navigate],
  );
}
