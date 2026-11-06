import { useEffect, useRef } from 'react';
import { onDataChanged } from '@/services/datasource/events';

/** Ejecuta `fn` cuando cambian las colecciones indicadas (en esta u otra pestaña). */
export function useDataChanged(collections, fn) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  const key = collections.join('|');
  useEffect(() => {
    const watched = new Set(key.split('|'));
    return onDataChanged((changed) => {
      if (changed.some((c) => watched.has(c))) ref.current();
    });
  }, [key]);
}
