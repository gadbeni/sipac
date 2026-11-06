import { createTheme } from '@mui/material/styles';
import { esES } from '@mui/material/locale';
import { tokens, statusTones, chartSeries } from './palette';
import { typography } from './typography';
import { components } from './components';

/**
 * Genera el tema MUI para `mode` ('light' | 'dark').
 * Expone además `theme.palette.brand`, `theme.palette.status` (tonos de chips) y
 * `theme.palette.chart` (series de gráficos), usados por StatusChip y useChartColors.
 */
export function createAppTheme(mode = 'light') {
  const t = tokens[mode] || tokens.light;
  return createTheme(
    {
      palette: {
        mode,
        primary: t.primary,
        secondary: t.secondary,
        success: t.success,
        warning: t.warning,
        error: t.error,
        info: t.info,
        background: { default: t.background.default, paper: t.background.paper },
        text: t.text,
        divider: t.divider,
        action: { ...t.action },
        brand: t.brand,
        subtle: t.background.subtle,
        status: statusTones[mode],
        chart: chartSeries[mode],
      },
      typography,
      shape: { borderRadius: 10 },
      components: components(t),
    },
    esES,
  );
}
