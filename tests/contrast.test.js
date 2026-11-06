import { describe, expect, it } from 'vitest';
import { tokens, statusTones } from '@/theme/palette';

const lum = (hex) => {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/\w\w/g)
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe('contraste WCAG AA (≥ 4,5:1 texto normal)', () => {
  for (const mode of ['light', 'dark']) {
    const t = tokens[mode];
    const surfaces = {
      default: t.background.default,
      paper: t.background.paper,
      subtle: t.background.subtle,
    };

    it(`${mode}: textos sobre fondos`, () => {
      for (const [sn, bg] of Object.entries(surfaces)) {
        for (const k of ['primary', 'secondary']) {
          expect(ratio(t.text[k], bg), `text.${k} / ${sn}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(ratio(t.primary.main, bg), `primary.main (enlaces) / ${sn}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${mode}: botones y avisos rellenos`, () => {
      for (const k of ['primary', 'secondary', 'success', 'warning', 'error', 'info']) {
        expect(ratio(t[k].main, t[k].contrastText), `${k}.main / contrastText`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${mode}: chips de estado`, () => {
      for (const [k, c] of Object.entries(statusTones[mode])) {
        expect(ratio(c.fg, c.bg), `status.${k}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
