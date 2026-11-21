import { Capacitor } from '@capacitor/core';
import { tx } from './i18n';
import { isElectron } from './platform';

/** Where the project lives: releases, issues and sponsorship all point here. */
export const REPO = 'MinaryHub/BangDB.Manager';
export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const SPONSOR_URL = 'https://github.com/sponsors/knoxxr';
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export type Platform = 'desktop' | 'android' | 'ios' | 'pwa' | 'web';

export function platform(): Platform {
  if (isElectron) return 'desktop';
  const p = Capacitor.getPlatform();
  if (p === 'android' || p === 'ios') return p;
  return typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches ? 'pwa' : 'web';
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  desktop: tx('Desktop app'), android: tx('Android app'), ios: tx('iOS app'), pwa: tx('Installed web app (PWA)'), web: tx('Web browser')
};

/** Operating system and browser in one short line, for bug reports. */
export function systemLine(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const os = /Windows NT 10/.test(ua) ? 'Windows 10/11' : /Windows/.test(ua) ? 'Windows' : /Android ([\d.]+)/.exec(ua)?.[0] ?? (/iPhone|iPad/.test(ua) ? `iOS ${/OS ([\d_]+)/.exec(ua)?.[1]?.replace(/_/g, '.') ?? ''}`.trim() : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown OS');
  const browser = /Electron\/([\d.]+)/.exec(ua)?.[0] ?? /Edg\/([\d.]+)/.exec(ua)?.[0] ?? /Chrome\/([\d.]+)/.exec(ua)?.[0] ?? /Firefox\/([\d.]+)/.exec(ua)?.[0] ?? /Version\/([\d.]+).*Safari/.exec(ua)?.[0] ?? 'browser';
  return `${os} · ${browser}`;
}

/** Open a web page outside the app (system browser on desktop and phones). */
export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener');
}
