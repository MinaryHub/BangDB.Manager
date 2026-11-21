import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ko from './ko';

/** Every literal passed to t(), tx() and tp() in src/ (and electron/ menus). */
function keys(): Map<string, string> {
  const out = new Map<string, string>();
  const lit = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")`;
  const one = new RegExp(String.raw`\b(?:t|tx)\(\s*` + lit, 'g');
  const plural = new RegExp(String.raw`\btp\([^,]+,\s*` + lit + String.raw`\s*,\s*` + lit, 'g');
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { if (n !== 'i18n') walk(p); continue; }
      if (!/\.(tsx?|mjs)$/.test(n) || /\.test\./.test(n)) continue;
      const src = readFileSync(p, 'utf8');
      // eslint-disable-next-line no-new-func
      const value = (l: string) => Function(`return ${l}`)() as string;
      for (const m of src.matchAll(one)) out.set(value(m[1]), p);
      for (const m of src.matchAll(plural)) out.set(value(m[2]), p); // Korean has no singular form: only the plural key is looked up
    }
  };
  walk('src');
  return out;
}

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('Korean UI text', () => {
  const used = keys();
  it('has a translation for every UI string', () => {
    const missing = [...used].filter(([k]) => !(k in ko)).map(([k, f]) => `${f}: ${k}`);
    expect(missing).toEqual([]);
  });
  it('keeps the placeholders of each string', () => {
    const bad = Object.entries(ko).filter(([k, v]) => holes(k) !== holes(v)).map(([k, v]) => `${k} → ${v}`);
    expect(bad).toEqual([]);
  });
  it('has no empty translations', () => {
    expect(Object.entries(ko).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });
});
