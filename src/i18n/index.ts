/**
 * UI language: English (the source text) or Korean.
 *
 *   t('Save changes')                       → "변경 사항 저장" in Korean
 *   t('Deleted {n} rows', { n })            → placeholders in {braces}
 *   tp(n, '{n} row', '{n} rows')            → English singular/plural; Korean uses the plural key
 *   tx('Rewrites the file')                 → marks a constant for translation; call t(value) where it is shown
 *
 * Keys are the English strings themselves, so a missing translation shows
 * English. src/i18n/i18n.test.ts checks every key in the source has a
 * Korean entry with the same placeholders. The Korean table is loaded only
 * when Korean is chosen.
 */
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'ko';
export const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'ko', label: '한국어' }];

const KEY = 'bangdb-manager.lang';
let lang: Lang = 'en';
let dict: Record<string, string> = {};
const subs = new Set<() => void>();

function stored(): Lang {
  try { return localStorage.getItem(KEY) === 'ko' ? 'ko' : 'en'; } catch { return 'en'; }
}

async function loadDict(l: Lang): Promise<Record<string, string>> {
  return l === 'ko' ? (await import('./ko')).default : {};
}

function apply(l: Lang, d: Record<string, string>) {
  lang = l;
  dict = d;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  // the desktop shell translates its menus and dialogs too
  (window as unknown as { bangdbDesktop?: { setLanguage?: (l: string) => void } }).bangdbDesktop?.setLanguage?.(l);
  subs.forEach((s) => s());
}

/** Load the saved language before the first render (Korean users wait for one small file). */
export async function initLang() {
  if (typeof window === 'undefined') return;
  const l = stored();
  try { apply(l, await loadDict(l)); } catch { apply('en', {}); }
}

export async function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable: this session only */ }
  apply(l, await loadDict(l));
}

export const getLang = () => lang;

export function useLang(): Lang {
  return useSyncExternalStore((s) => { subs.add(s); return () => subs.delete(s); }, () => lang, () => lang);
}

const fill = (s: string, vars?: Record<string, unknown>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

/** Translate an English UI string. */
export function t(s: string, vars?: Record<string, unknown>): string {
  return fill(dict[s] ?? s, vars);
}

/** Singular / plural: English picks by n; other languages translate the plural form. `{n}` is filled with n (localized). */
export function tp(n: number, one: string, many: string, vars?: Record<string, unknown>): string {
  const key = lang === 'en' && n === 1 ? one : many;
  return fill(dict[key] ?? key, { n: n.toLocaleString(), ...vars });
}

/** Marks a string for translation without translating it now (constants); show it with t(value). */
export const tx = <S extends string>(s: S): S => s;
