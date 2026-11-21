// Desktop shell (Windows / Linux / macOS). It serves the built app from an
// in-process copy of the proxy + database gateway, so "via proxy" works for
// REST servers and PostgreSQL/MySQL/SQL Server/SQLite/MongoDB/Redis work
// without any extra install, and it can open the same server on the LAN so
// phones use the app without installing anything.
import { app, BrowserWindow, Menu, dialog, ipcMain, shell, clipboard, session } from 'electron';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createProxyServer, listen } from '../proxy/lib.mjs';
import { check as checkUpdates, initUpdater, statusLabel, updateIpc } from './updater.mjs';
import { onLanguage, setLanguage, tr } from './i18n.mjs';

const REPO_URL = 'https://github.com/knoxxr/BangDB.Manager';
const SPONSOR_URL = 'https://github.com/sponsors/knoxxr';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const LAN_PORT = Number(process.env.BANGDB_MANAGER_LAN_PORT || 8080);

// The gateway reads GATEWAY_TOKEN when it loads: fix a token first so that
// phones on the LAN can use it, and inject it into this window's own requests.
const TOKEN = process.env.GATEWAY_TOKEN || randomBytes(16).toString('hex');
process.env.GATEWAY_TOKEN = TOKEN;
if (!process.env.SQLITE_ROOT) process.env.SQLITE_ROOT = join(app.getPath('documents'), 'BangDB Manager');

let gateway = null;   // handleGateway, when the drivers are bundled
let gatewayError = '';
let local = null;     // { server, port } bound to 127.0.0.1 for the window
let lan = null;       // { server, port } bound to 0.0.0.0 for phones
let win = null;

async function loadGateway() {
  try {
    ({ handleGateway: gateway } = await import('../proxy/gateway/index.mjs'));
  } catch (e) {
    gatewayError = e.message;
  }
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  }
  return out;
}

async function startLocal() {
  const server = createProxyServer({ dist, gateway });
  const port = await listen(server, 0, '127.0.0.1');
  local = { server, port };
  // this window's pages get the gateway token automatically
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`http://127.0.0.1:${port}/gw/*`] }, (details, cb) => {
    details.requestHeaders['x-gateway-token'] = TOKEN;
    cb({ requestHeaders: details.requestHeaders });
  });
}

async function toggleLan(item) {
  if (lan) {
    lan.server.close();
    lan = null;
    if (item) item.checked = false;
    return;
  }
  const server = createProxyServer({ dist, gateway });
  try {
    const port = await listen(server, LAN_PORT, '0.0.0.0');
    lan = { server, port };
    if (item) item.checked = true;
    showLanAddresses();
  } catch (e) {
    if (item) item.checked = false;
    dialog.showErrorBox(tr('Allow phone access failed'), tr('Could not open port {port}: {error}', { port: LAN_PORT, error: e.message }));
  }
}

function showLanAddresses() {
  if (!lan) {
    dialog.showMessageBox(win, { type: 'info', message: tr('Phone access is off'), detail: tr('Turn on "Allow phone access" in the Server menu.') });
    return;
  }
  const urls = lanAddresses().map((a) => `http://${a}:${lan.port}`);
  const detail = [
    urls.length ? urls.join('\n') : tr("http://<this PC's IP>:{port}", { port: lan.port }),
    '',
    tr('Once open, use "Add to Home Screen" to use it like an app. The firewall must allow port {port}.', { port: lan.port }),
    gateway ? tr('To use gateway databases such as PostgreSQL from a phone, enter this value as the gateway token when editing the connection:\n{token}', { token: TOKEN }) : ''
  ].join('\n');
  dialog.showMessageBox(win, {
    type: 'info', message: tr('Open in a phone browser on the same network'), detail,
    buttons: [tr('Copy address'), tr('Copy token'), tr('Close')], defaultId: 0, cancelId: 2
  }).then((r) => {
    if (r.response === 0 && urls.length) clipboard.writeText(urls[0]);
    if (r.response === 1) clipboard.writeText(TOKEN);
  });
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: tr('File'), submenu: [{ role: 'quit', label: tr('Quit') }] },
    {
      label: tr('Server'),
      submenu: [
        { id: 'lan', label: tr('Allow phone access (port {port})', { port: LAN_PORT }), type: 'checkbox', checked: !!lan, click: (item) => toggleLan(item) },
        { label: tr('Show phone access address & token'), click: showLanAddresses },
        { type: 'separator' },
        { label: gateway ? tr('DB gateway: built in (SQLite folder: {folder})', { folder: process.env.SQLITE_ROOT }) : tr('DB gateway unavailable: {error}', { error: gatewayError }), enabled: false }
      ]
    },
    { label: tr('View'), submenu: [{ role: 'reload', label: tr('Refresh') }, { role: 'toggleDevTools', label: tr('Developer tools') }, { type: 'separator' }, { role: 'resetZoom', label: tr('Actual size') }, { role: 'zoomIn', label: tr('Zoom in') }, { role: 'zoomOut', label: tr('Zoom out') }, { type: 'separator' }, { role: 'togglefullscreen', label: tr('Full screen') }] },
    { label: tr('Help'), submenu: [
      { label: tr('Check for updates'), click: () => checkUpdates(true) },
      { label: statusLabel(), enabled: false },
      { type: 'separator' },
      { label: tr('Version history'), click: () => openInApp('/about/versions') },
      { label: tr('Release notes on GitHub'), click: () => shell.openExternal(`${REPO_URL}/releases`) },
      { type: 'separator' },
      { label: tr('Report a bug or ask a question…'), click: () => openInApp('/about') },
      { label: tr('Browse issues'), click: () => shell.openExternal(`${REPO_URL}/issues`) },
      { label: tr('Sponsor BangDB Manager ♥'), click: () => shell.openExternal(SPONSOR_URL) },
      { label: tr('GitHub repository'), click: () => shell.openExternal(REPO_URL) },
      { label: tr('Version {v}', { v: app.getVersion() }), enabled: false }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Show a page of the app (hash route) in the window. */
function openInApp(route) {
  if (!win) createWindow();
  win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(`#${route}`)}`).catch(() => {});
  win.show();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 780, minWidth: 360, minHeight: 480,
    title: 'BangDB Manager', backgroundColor: '#0f172a',
    icon: join(here, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: join(here, 'preload.cjs') }
  });
  win.loadURL(`http://127.0.0.1:${local.port}/`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  await loadGateway();
  try {
    await startLocal();
  } catch (e) {
    dialog.showErrorBox(tr('Startup failed'), tr('Could not start the internal server: {error}', { error: e.message }));
    app.quit();
    return;
  }
  updateIpc(ipcMain);
  // the page reports its language; menus and dialogs follow it
  ipcMain.on('app:set-language', (_e, l) => setLanguage(l));
  onLanguage(() => buildMenu());
  buildMenu();
  createWindow();
  initUpdater({ getWindow: () => win, onState: () => buildMenu() });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { local?.server.close(); lan?.server.close(); });
