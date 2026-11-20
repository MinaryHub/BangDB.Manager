import { useSyncExternalStore } from 'react';

/** "auto" follows the operating system; the others force a palette. */
export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'bangdb-manager.theme';
const subs = new Set<() => void>();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let current: Theme = typeof localStorage !== 'undefined' ? read() : 'auto';

/** Put the theme on <html> (styles.css keys the palette off data-theme) and the browser chrome colour. */
export function applyTheme(t: Theme = current) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && !window.matchMedia?.('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1220' : '#f3f5f9');
}

export function setTheme(t: Theme) {
  current = t;
  try {
    if (t === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* storage unavailable: the choice lasts for this session */
  }
  applyTheme(t);
  subs.forEach((s) => s());
}

/** Next theme in the toggle cycle auto → light → dark → auto. */
export const nextTheme = (t: Theme): Theme => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto');

export function useTheme(): Theme {
  return useSyncExternalStore(
    (s) => { subs.add(s); return () => subs.delete(s); },
    () => current,
    () => current
  );
}
