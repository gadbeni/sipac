import { useCallback, useState } from 'react';

const MESSAGES = {
  1: 'No se otorgó permiso de ubicación. Puede seguir buscando por nombre o municipio.',
  2: 'No se pudo determinar su ubicación.',
  3: 'La ubicación tardó demasiado en responder.',
};

/**
 * Ubicación del usuario bajo demanda (nunca al cargar la página). La posición no se guarda
 * ni se envía: solo se usa en el navegador para calcular distancias.
 */
export function useGeolocation() {
  const [state, setState] = useState({ position: null, loading: false, error: null });
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const request = useCallback(() => {
    if (!supported) {
      setState({ position: null, loading: false, error: 'Este navegador no permite obtener la ubicación.' });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setState({
          position: { lat: p.coords.latitude, lng: p.coords.longitude },
          loading: false,
          error: null,
        }),
      (e) => setState({ position: null, loading: false, error: MESSAGES[e.code] || MESSAGES[2] }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [supported]);

  const clear = useCallback(() => setState({ position: null, loading: false, error: null }), []);
  return { ...state, supported, request, clear };
}
