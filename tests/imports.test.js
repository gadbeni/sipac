import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f) ? [p] : [];
  });

describe('importaciones', () => {
  it('todos los iconos de @mui/icons-material existen en la versión instalada', () => {
    const missing = [];
    for (const file of walk('src')) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(
        /@mui\/icons-material\/([A-Za-z0-9]+)['"]/g,
      )) {
        if (!existsSync(join('node_modules/@mui/icons-material', `${name}.js`)))
          missing.push(`${file}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
