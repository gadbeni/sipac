/**
 * Overrides globales de componentes MUI (ARCHITECTURE §7).
 * Objetivos: superficies con borde sutil, objetivos táctiles ≥ 44 px y foco visible.
 */
import { alpha } from '@mui/material/styles';

export function components(t) {
  const focusRing = `0 0 0 3px ${alpha(t.primary.main, 0.45)}`;
  return {
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitTextSizeAdjust: '100%' },
        body: { overflowX: 'hidden' },
        '#root': { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
        '::selection': { background: alpha(t.primary.main, 0.25) },
        'a:focus-visible, button:focus-visible': { outline: 'none' },
        code: {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.875em',
          padding: '0.1em 0.35em',
          borderRadius: 4,
          background: t.background.subtle,
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: t.divider } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 12, borderColor: t.divider, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' },
      },
    },
    MuiCardHeader: {
      styleOverrides: { title: { fontSize: '1rem', fontWeight: 600 }, subheader: { fontSize: '0.8125rem' } },
    },
    MuiButtonBase: { defaultProps: { disableRipple: false } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, minHeight: 40, '&.Mui-focusVisible': { boxShadow: focusRing } },
        sizeLarge: { minHeight: 48, fontSize: '1rem', paddingInline: 22 },
        sizeSmall: { minHeight: 32 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { '&.Mui-focusVisible': { boxShadow: focusRing } } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 44,
          '&.Mui-selected': { backgroundColor: t.action.selected, color: t.primary.main },
          '&.Mui-selected .MuiListItemIcon-root': { color: t.primary.main },
          '&.Mui-focusVisible': { boxShadow: `inset ${focusRing}` },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 40, color: t.text.secondary } } },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          backgroundColor: t.background.paper,
          borderBottom: `1px solid ${t.divider}`,
          color: t.text.primary,
        },
      },
    },
    MuiDrawer: { styleOverrides: { paper: { borderColor: t.divider, backgroundImage: 'none' } } },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: t.background.subtle,
            color: t.text.secondary,
            fontWeight: 600,
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
          },
        },
      },
    },
    MuiTableCell: { styleOverrides: { root: { borderColor: t.divider } } },
    MuiTableRow: {
      styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: t.action.hover } } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTooltip: { defaultProps: { arrow: true }, styleOverrides: { tooltip: { fontSize: '0.8125rem' } } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 14 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10, alignItems: 'flex-start' } } },
    MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiLink: { defaultProps: { underline: 'hover' } },
    MuiSkeleton: { defaultProps: { animation: 'wave' } },
  };
}
