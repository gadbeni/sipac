/**
 * Colores para Recharts derivados del tema MUI (Recharts no lee el tema).
 * Los gráficos cambian con el modo oscuro al usar este hook.
 */
import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';

export function chartColorsFromTheme(theme) {
  const p = theme.palette;
  return {
    series: p.chart,
    axis: p.text.secondary,
    grid: p.divider,
    text: p.text.primary,
    muted: p.text.secondary,
    surface: p.background.paper,
    tooltip: {
      contentStyle: {
        background: p.background.paper,
        border: `1px solid ${p.divider}`,
        borderRadius: 8,
        color: p.text.primary,
        fontSize: 13,
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
      },
      labelStyle: { color: p.text.primary, fontWeight: 600, marginBottom: 4 },
      itemStyle: { color: p.text.primary, padding: 0 },
      cursor: { fill: p.action.hover, stroke: p.divider },
    },
    status: {
      success: p.success.main,
      warning: p.warning.main,
      error: p.error.main,
      info: p.info.main,
    },
    font: { fontSize: 12, fill: p.text.secondary },
  };
}

export function useChartColors() {
  const theme = useTheme();
  return useMemo(() => chartColorsFromTheme(theme), [theme]);
}
