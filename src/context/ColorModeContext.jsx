/**
 * Modo de color: 'light' | 'dark' | 'system'. Persistente en `sipac:pref:colorMode`.
 * Con 'system' sigue a `prefers-color-scheme` y reacciona a cambios del sistema operativo.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { createAppTheme } from '@/theme/createAppTheme';
import { readPref, writePref, prefKey } from '@/utils/preferences';

const MODES = ['light', 'dark', 'system'];
const ColorModeContext = createContext(null);

export function ColorModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const saved = readPref('colorMode', 'system');
    return MODES.includes(saved) ? saved : 'system';
  });
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

  const setMode = useCallback((m) => {
    if (!MODES.includes(m)) return;
    setModeState(m);
    writePref('colorMode', m);
  }, []);

  const toggle = useCallback(() => setMode(resolved === 'dark' ? 'light' : 'dark'), [resolved, setMode]);

  // Sincroniza la preferencia entre pestañas.
  useEffect(() => {
    const onStorage = (ev) => {
      if (ev.key !== prefKey('colorMode') || !ev.newValue) return;
      try {
        const m = JSON.parse(ev.newValue);
        if (MODES.includes(m)) setModeState(m);
      } catch {
        /* valor inválido */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#111827' : '#159B72');
  }, [resolved]);

  const theme = useMemo(() => createAppTheme(resolved), [resolved]);
  const value = useMemo(() => ({ mode, resolved, setMode, toggle }), [mode, resolved, setMode, toggle]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode debe usarse dentro de ColorModeProvider');
  return ctx;
}
