/**
 * Tokens de color de SIPAC para los modos claro y oscuro (ARCHITECTURE §7).
 *
 * El verde institucional #159B72 se conserva como color de marca (logo, acentos, gráficos),
 * pero con texto blanco alcanza 3,5:1 y no cumple WCAG AA para texto normal. Por eso
 * `primary.main` (botones, enlaces) usa una variante más oscura del mismo tono. Todas las
 * combinaciones texto/fondo se verifican en tests/contrast.test.js.
 */
import { appConfig } from '@/config/app.config';

const brand = appConfig.branding.colors;

export const tokens = {
  light: {
    brand: brand.primary,
    primary: { main: '#0E7A5A', light: brand.primary, dark: '#0A5C44', contrastText: '#FFFFFF' },
    secondary: { main: brand.secondary, light: '#14B8A6', dark: '#115E59', contrastText: '#FFFFFF' },
    success: { main: '#15803D', contrastText: '#FFFFFF' },
    warning: { main: '#B45309', contrastText: '#FFFFFF' },
    error: { main: '#B91C1C', contrastText: '#FFFFFF' },
    info: { main: '#1D4ED8', contrastText: '#FFFFFF' },
    background: { default: brand.background, paper: '#FFFFFF', subtle: '#EEF2F6' },
    text: { primary: brand.text, secondary: '#475569', disabled: '#94A3B8' },
    divider: brand.border,
    action: { hover: 'rgba(15, 23, 42, 0.05)', selected: 'rgba(14, 122, 90, 0.10)' },
  },
  dark: {
    brand: '#2BB58A',
    primary: { main: '#2BB58A', light: '#5EEAD4', dark: '#159B72', contrastText: '#0B1220' },
    secondary: { main: '#2DD4BF', light: '#5EEAD4', dark: '#0F766E', contrastText: '#0B1220' },
    success: { main: '#4ADE80', contrastText: '#0B1220' },
    warning: { main: '#FBBF24', contrastText: '#0B1220' },
    error: { main: '#F87171', contrastText: '#0B1220' },
    info: { main: '#60A5FA', contrastText: '#0B1220' },
    background: { default: '#0B1220', paper: '#111827', subtle: '#1A2333' },
    text: { primary: '#E2E8F0', secondary: '#94A3B8', disabled: '#64748B' },
    divider: '#1F2A3A',
    action: { hover: 'rgba(226, 232, 240, 0.06)', selected: 'rgba(43, 181, 138, 0.16)' },
  },
};

/**
 * Tonos "suaves" para chips de estado y avisos: fondo tenue + texto oscuro (claro) o
 * fondo profundo + texto claro (oscuro). Contraste ≥ 4,5:1 en ambos modos.
 */
export const statusTones = {
  light: {
    success: { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
    warning: { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' },
    error: { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5' },
    info: { bg: '#DBEAFE', fg: '#1E40AF', border: '#93C5FD' },
    primary: { bg: '#CCFBF1', fg: '#115E59', border: '#5EEAD4' },
    neutral: { bg: '#F1F5F9', fg: '#334155', border: '#CBD5E1' },
  },
  dark: {
    success: { bg: '#0F2E1E', fg: '#86EFAC', border: '#166534' },
    warning: { bg: '#33240A', fg: '#FCD34D', border: '#92400E' },
    error: { bg: '#3A1414', fg: '#FCA5A5', border: '#991B1B' },
    info: { bg: '#132447', fg: '#93C5FD', border: '#1E40AF' },
    primary: { bg: '#0D2F2A', fg: '#5EEAD4', border: '#115E59' },
    neutral: { bg: '#1E293B', fg: '#CBD5E1', border: '#334155' },
  },
};

/**
 * Paleta categórica para gráficos: orden fijo validado para daltonismo (ΔE ≥ 8 entre
 * series adyacentes). Nunca se reasigna por ranking: la serie conserva su color.
 */
export const chartSeries = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
