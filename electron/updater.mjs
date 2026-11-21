// Auto-update for the desktop app.
//  - Windows (NSIS) and Linux AppImage: electron-updater downloads the new
//    version from the GitHub release and installs it on restart.
//  - macOS (unsigned build) and Linux deb: electron-updater cannot replace
//    the app, so we only look up the latest GitHub release and offer the
//    download page.
// BANGDB_MANAGER_NO_UPDATE=1 turns everything off; the About page's
// "Check for updates automatically" turns the scheduled checks off.
// Results of scheduled checks go to the app window (update bar, About page);
// the Help menu's manual check answers with dialogs.
import { app, dialog, shell } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import updater from 'electron-updater';

const { autoUpdater } = updater;
export const REPO = 'knoxxr/BangDB.Manager';
const RELEASES = `https://github.com/${REPO}/releases/latest`;
const CHECK_EVERY = 4 * 60 * 60 * 1000;

export const state = { mode: 'off', status: 'idle', version: '', percent: 0, error: '', auto: true, url: '' };
let onChange = () => {};
let timer = null;
let win = () => null;

export function updateMode() {
  if (process.env.BANGDB_MANAGER_NO_UPDATE) return 'off';
  if (!app.isPackaged) return 'off';
  if (process.platform === 'win32') return 'auto';
  if (process.platform === 'linux') return process.env.APPIMAGE ? 'auto' : 'notify';
  return 'notify';
}

function set(patch) {
  Object.assign(state, patch);
  onChange(state);
  const w = win();
  if (w && !w.isDestroyed()) w.webContents.send('update:state', { ...state });
}

const prefsPath = () => join(app.getPath('userData'), 'updater.json');
function prefs() { try { return JSON.parse(readFileSync(prefsPath(), 'utf8')); } catch { return {}; } }
function savePrefs(p) { try { writeFileSync(prefsPath(), JSON.stringify(p)); } catch { /* ignore */ } }

/** 1 when a is newer than b, -1 when older, 0 when equal. Tags may start with "v". */
export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function initUpdater({ getWindow, onState }) {
  win = getWindow;
  onChange = onState ?? onChange;
  set({ mode: updateMode(), auto: prefs().auto !== false });
  if (state.mode === 'off') return;
  if (state.mode === 'auto') {
    autoUpdater.autoDownload = state.auto;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;
    autoUpdater.on('checking-for-update', () => set({ status: 'checking', error: '' }));
    autoUpdater.on('update-available', (info) => set({ status: autoUpdater.autoDownload ? 'downloading' : 'available', version: info.version, percent: 0, url: RELEASES }));
    autoUpdater.on('update-not-available', (info) => set({ status: 'none', version: info?.version ?? '' }));
    autoUpdater.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent) }));
    autoUpdater.on('error', (e) => set({ status: 'error', error: e?.message ?? String(e) }));
    // the app window shows "ready — Restart now"; otherwise it installs when the app closes
    autoUpdater.on('update-downloaded', (info) => set({ status: 'downloaded', version: info.version, percent: 100 }));
  }
  schedule();
  app.on('before-quit', () => clearInterval(timer));
}

function schedule() {
  clearInterval(timer);
  timer = null;
  if (state.mode === 'off' || !state.auto) return;
  setTimeout(() => { if (state.auto) check(false); }, 8000);
  timer = setInterval(() => check(false), CHECK_EVERY);
}

/** Update controls for the app window (electron/preload.cjs). */
export function updateIpc(ipcMain) {
  ipcMain.handle('update:state', () => ({ ...state }));
  // a check started in the app: results show in the app, not in dialogs; a skipped version counts again
  ipcMain.handle('update:check', () => check(false, { force: true }));
  ipcMain.handle('update:install', () => { if (state.status === 'downloaded') setImmediate(() => autoUpdater.quitAndInstall()); else if (state.url) shell.openExternal(state.url); });
  ipcMain.handle('update:set-auto', (_e, on) => {
    savePrefs({ ...prefs(), auto: !!on });
    if (state.mode === 'auto') autoUpdater.autoDownload = !!on;
    set({ auto: !!on });
    schedule();
  });
  ipcMain.handle('update:skip', (_e, v) => { savePrefs({ ...prefs(), skip: String(v) }); set({ status: 'none' }); });
}

/** Check now. With manual=true the result is always shown in a dialog. */
export async function check(manual, { force = false } = {}) {
  if (state.mode === 'off') {
    if (manual) dialog.showMessageBox(win(), { type: 'info', message: 'Automatic updates are off', detail: app.isPackaged ? 'The BANGDB_MANAGER_NO_UPDATE environment variable is set.' : 'Not available in development mode.' });
    return;
  }
  if (state.mode === 'auto') {
    try {
      // with automatic downloads off a manual / in-app check still fetches the update
      if (manual || force) autoUpdater.autoDownload = true;
      const r = await autoUpdater.checkForUpdates();
      autoUpdater.autoDownload = state.auto;
      const v = r?.updateInfo?.version;
      if (!v || compareVersions(v, app.getVersion()) <= 0) set({ status: 'none', version: v ?? '' });
      if (manual && v && compareVersions(v, app.getVersion()) <= 0) {
        dialog.showMessageBox(win(), { type: 'info', message: "You're up to date", detail: `Current version: ${app.getVersion()}` });
      } else if (manual && v) {
        dialog.showMessageBox(win(), { type: 'info', message: `Downloading ${v}`, detail: 'When the download finishes, the app shows a Restart button; otherwise it installs when you close the app.' });
      }
    } catch (e) {
      set({ status: 'error', error: e?.message ?? String(e) });
      if (manual) dialog.showErrorBox('Update check failed', state.error);
    }
    return;
  }
  // notify mode: look at the latest GitHub release
  set({ status: 'checking', error: '' });
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'bangdb-manager' } });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const rel = await res.json();
    const latest = String(rel.tag_name ?? '').replace(/^v/, '');
    if (!latest) throw new Error('Tag not found');
    if (compareVersions(latest, app.getVersion()) <= 0) {
      set({ status: 'none', version: latest });
      if (manual) dialog.showMessageBox(win(), { type: 'info', message: "You're up to date", detail: `Current version: ${app.getVersion()}` });
      return;
    }
    const p = prefs();
    set({ status: !manual && !force && p.skip === latest ? 'none' : 'available', version: latest, url: rel.html_url || RELEASES });
    // scheduled checks and in-app checks are shown by the app window
    if (!manual) return;
    const r = await dialog.showMessageBox(win(), {
      type: 'info', message: `New version ${latest} available (current: ${app.getVersion()})`,
      detail: `The ${process.platform === 'darwin' ? 'macOS' : 'deb'} build does not support automatic installation. Download the new installer from the download page.`,
      buttons: ['Open download page', 'Skip this version', 'Later'], defaultId: 0, cancelId: 2
    });
    if (r.response === 0) shell.openExternal(rel.html_url || RELEASES);
    if (r.response === 1) savePrefs({ ...p, skip: latest });
  } catch (e) {
    set({ status: 'error', error: e?.message ?? String(e) });
    if (manual) dialog.showErrorBox('Update check failed', state.error);
  }
}

/** Short text for the menu. */
export function statusLabel() {
  switch (state.status) {
    case 'checking': return 'Checking for updates…';
    case 'downloading': return `Downloading update ${state.version} ${state.percent}%`;
    case 'downloaded': return `Update ${state.version} ready to install (applied on restart)`;
    case 'available': return `New version ${state.version} available`;
    case 'none': return `Up to date (${app.getVersion()})`;
    case 'error': return `Update error: ${state.error.slice(0, 60)}`;
    default: return state.mode === 'off' ? 'Automatic updates off' : `Version ${app.getVersion()}`;
  }
}
