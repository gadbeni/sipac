import { useCallback, useEffect, useRef, useState } from 'react';
import { useDataChanged } from './useDataChanged';
import { isAppError } from '@/services/errors';

/**
 * Carga asíncrona con estados `loading` / `error` / `data`.
 *  - `deps`: vuelve a cargar cuando cambian.
 *  - `watch`: colecciones cuyo cambio provoca recarga silenciosa (sin parpadeo de skeleton).
 * Descarta respuestas obsoletas si las dependencias cambian antes de que termine.
 */
export function useAsync(fn, deps = [], { watch = [], initial = null } = {}) {
  const [state, setState] = useState({ data: initial, loading: true, error: null });
  const seq = useRef(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback((silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(() => fnRef.current())
      .then(
        (data) => id === seq.current && setState({ data, loading: false, error: null }),
        (error) => {
          if (id !== seq.current) return;
          // Los errores de negocio (AppError) se muestran en pantalla; solo se registran los inesperados.
          if (!isAppError(error)) console.error(error);
          setState((s) => ({ ...s, loading: false, error }));
        },
      );
  }, []);

  // Carga de datos al montar / cambiar dependencias (patrón intencional de fetch).
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => void run(), deps);
  useDataChanged(watch, () => run(true));

  return { ...state, reload: run };
}
