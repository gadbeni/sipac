import { useEffect } from 'react';
import { appConfig } from '@/config/app.config';

const DEFAULT_DESCRIPTION = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

/** SEO básico: título de la pestaña y meta description por página. */
export function useDocumentMeta(title, description) {
  useEffect(() => {
    document.title = title
      ? `${title} · ${appConfig.appName}`
      : `${appConfig.appName} — ${appConfig.appFullName}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', description || DEFAULT_DESCRIPTION);
  }, [title, description]);
}
