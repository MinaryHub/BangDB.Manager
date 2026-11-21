/**
 * One update service for every way the app runs:
 *  - web / PWA: the service worker fetches a new build; applying reloads
 *  - Android / iOS: the newest GitHub release is compared with this build;
 *    the user downloads the new package
 *  - desktop: electron-updater in the main process (through the preload
 *    bridge) downloads and installs on Windows / AppImage, and only
 *    announces new releases for macOS and deb builds
 * The About page, the update bar and the quick-open palette all read this.
 */
import { useSyncExternalStore } from 'react';
import { APP_VERSION, REPO, platform } from './appinfo';
import { t } from './i18n';

export type UpdateStatus = 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error' | 'unsupported';

export interface UpdateState {
  /** How updates arrive here. */
  mode: 'pwa' | 'store' | 'desktop-auto' | 'desktop-notify' | 'off';
  status: UpdateStatus;
  /** The newer version, when one is known. */
  version?: string;
  percent?: number;
  /** Download / release page for "available". */
  url?: string;
  error?: string;
  checkedAt?: number;
  auto: boolean;
  /** Set once after the app started on a newer version than last time. */
  updatedFrom?: string;
  /** The user closed the update bar for this status. */
  barHidden?: boolean;
}

/** What the desktop preload exposes (electron/preload.cjs). */
interface DesktopBridge {
  update: {
    state(): Promise<{ mode: string; status: string; version: string; percent: number; error: string; auto: boolean; url?: string }>;
    check(): Promise<unknown>;
    install(): Promise<void>;
    setAuto(on: boolean): Promise<void>;
    skip(version: string): Promise<void>;
    onState(cb: (s: Awaited<ReturnType<DesktopBridge['update']['state']>>) => void): () => void;
  };
}
const desktop = (): DesktopBridge | undefined => (typeof window !== 'undefined' ? (window as unknown as { bangdbDesktop?: DesktopBridge }).bangdbDesktop : undefined);

const AUTO_KEY = 'bangdb-manager.auto-update';
const CHECK_KEY = 'bangdb-manager.update-check';
const SKIP_KEY = 'bangdb-manager.update-skip';
const SEEN_KEY = 'bangdb-manager.last-version';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ls = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
};

/** 1 when a is newer than b, -1 when older, 0 when equal. Tags may start with "v". */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export interface ReleaseAsset { name: string; browser_download_url: string; size?: number; download_count?: number }
export interface Release { tag_name: string; name?: string; html_url: string; body?: string; published_at?: string; prerelease?: boolean; draft?: boolean; assets?: ReleaseAsset[] }

/** Picks the download for this platform from a release's assets (the release page otherwise). */
export function downloadFor(rel: Release, p: string, ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const want = p === 'android' ? /android.*\.apk$/i
    : p === 'ios' ? /\.ipa$/i
    : p === 'desktop' ? (/Windows/.test(ua) ? /windows.*\.exe$/i : /Mac OS X/.test(ua) ? /macos.*\.dmg$/i : /\.AppImage$/i)
    : /web.*\.zip$/i;
  return rel.assets?.find((a) => want.test(a.name))?.browser_download_url ?? rel.html_url;
}

/** Published releases, newest first (GitHub's REST API, no token: 60 requests an hour per IP). */
export async function fetchReleases(limit = 30): Promise<Release[]> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${limit}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(res.status === 403 ? t('GitHub rate limit reached — try again later') : t('GitHub answered {status}', { status: res.status }));
  const list = (await res.json()) as Release[];
  return list.filter((r) => !r.draft).sort((a, b) => compareVersions(b.tag_name, a.tag_name));
}

// ------------------------------------------------------------------ store

let state: UpdateState = { mode: 'off', status: 'idle', auto: ls.get(AUTO_KEY) !== 'off' };
const subs = new Set<() => void>();
function set(p: Partial<UpdateState>) {
  // a new status (or version) brings the bar back
  const fresh = (p.status !== undefined && p.status !== state.status) || (p.version !== undefined && p.version !== state.version);
  state = { ...state, ...(fresh ? { barHidden: false } : {}), ...p };
  subs.forEach((s) => s());
}

export function useUpdate(): UpdateState {
  return useSyncExternalStore((s) => { subs.add(s); return () => subs.delete(s); }, () => state, () => state);
}
export const getUpdateState = () => state;

let applySw: ((reload?: boolean) => Promise<void>) | null = null;
let swReg: ServiceWorkerRegistration | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let started = false;

/** Start once at app start: works out the mode, schedules checks when automatic updates are on. */
export function startUpdates() {
  if (started || typeof window === 'undefined') return;
  started = true;

  // "what's new" after an update: compare with the version that ran last
  const seen = ls.get(SEEN_KEY);
  if (seen && compareVersions(APP_VERSION, seen) > 0) set({ updatedFrom: seen });
  ls.set(SEEN_KEY, APP_VERSION);

  const p = platform();
  const bridge = desktop();
  if (bridge) {
    const take = (s: Awaited<ReturnType<DesktopBridge['update']['state']>>) => set({
      mode: s.mode === 'auto' ? 'desktop-auto' : s.mode === 'notify' ? 'desktop-notify' : 'off',
      status: s.mode === 'off' ? 'unsupported' : (s.status === 'downloaded' ? 'ready' : (s.status as UpdateStatus)),
      version: s.version || undefined, percent: s.percent, error: s.error || undefined, auto: s.auto, url: s.url,
      ...(s.status === 'none' || s.status === 'available' || s.status === 'downloaded' ? { checkedAt: Date.now() } : {})
    });
    bridge.update.state().then(take).catch(() => set({ mode: 'off', status: 'unsupported' }));
    bridge.update.onState(take);
    return;
  }
  if (p === 'android' || p === 'ios') {
    set({ mode: 'store' });
    const last = Number(ls.get(CHECK_KEY) || 0);
    if (state.auto && Date.now() - last > DAY) void checkStore(false);
    return;
  }
  set({ mode: 'pwa' });
  void import('virtual:pwa-register').then(({ registerSW }) => {
    applySw = registerSW({
      immediate: true,
      onNeedRefresh: () => set({ status: 'ready', checkedAt: Date.now() }),
      onRegisteredSW: (_url, r) => {
        swReg = r;
        if (!r) { set({ status: 'unsupported' }); return; }
        schedulePwa();
      },
      onRegisterError: () => set({ status: 'unsupported' })
    });
  }).catch(() => set({ status: 'unsupported' }));
}

function schedulePwa() {
  if (timer) clearInterval(timer);
  timer = undefined;
  if (!state.auto || !swReg) return;
  // a new build every hour and whenever the app comes back to the foreground
  timer = setInterval(() => { void swReg?.update(); }, HOUR);
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.auto && state.mode === 'pwa') void swReg?.update().catch(() => {}); });
}

async function checkStore(manual: boolean) {
  set({ status: 'checking', error: undefined });
  try {
    const rel = (await fetchReleases(10)).find((r) => !r.prerelease);
    ls.set(CHECK_KEY, String(Date.now()));
    if (!rel) { set({ status: 'none', checkedAt: Date.now() }); return; }
    const latest = rel.tag_name.replace(/^v/, '');
    const newer = compareVersions(latest, APP_VERSION) > 0;
    const skipped = !manual && ls.get(SKIP_KEY) === latest;
    set({ status: newer && !skipped ? 'available' : 'none', version: newer ? latest : undefined, url: newer ? downloadFor(rel, platform()) : undefined, checkedAt: Date.now() });
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
  }
}

/** Check now (the "Check for updates" button). */
export async function checkForUpdates(): Promise<void> {
  const bridge = desktop();
  if (bridge) { set({ status: 'checking', error: undefined }); await bridge.update.check().catch((e) => set({ status: 'error', error: String(e?.message ?? e) })); return; }
  if (state.mode === 'store') return checkStore(true);
  if (!swReg) { set({ status: 'unsupported' }); return; }
  set({ status: 'checking', error: undefined });
  try {
    await swReg.update();
    // a new worker installs in the background; onNeedRefresh flips the state to "ready"
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && swReg.installing) await new Promise((r) => setTimeout(r, 250));
    if (getUpdateState().status === 'checking') set({ status: swReg.waiting ? 'ready' : 'none', checkedAt: Date.now() });
  } catch (e) {
    set({ status: 'error', error: navigator.onLine === false ? t('You are offline') : (e as Error).message });
  }
}

/** Apply a downloaded update: reload into the new build, or restart the desktop app. */
export async function applyUpdate() {
  const bridge = desktop();
  if (bridge) return bridge.update.install();
  if (applySw) return applySw(true);
}

/** Turn the automatic checks on or off (stored on this device). */
export async function setAutoUpdate(on: boolean) {
  ls.set(AUTO_KEY, on ? 'on' : 'off');
  set({ auto: on });
  const bridge = desktop();
  if (bridge) await bridge.update.setAuto(on);
  else if (state.mode === 'pwa') schedulePwa();
}

/** Do not announce this version again (it stays available from the About page). */
export async function skipVersion(version: string) {
  ls.set(SKIP_KEY, version);
  const bridge = desktop();
  if (bridge) await bridge.update.skip(version);
  set({ status: 'none' });
}

export const dismissUpdatedNotice = () => set({ updatedFrom: undefined });
/** Hide the bar for now; About still shows the update. */
export const dismissUpdateBar = () => set({ barHidden: true });
