// Bridge between the app page and the desktop shell (sandboxed preload:
// CommonJS, only contextBridge + ipcRenderer). Exposes update controls so
// the About page shows and drives electron-updater.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bangdbDesktop', {
  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    setAuto: (on) => ipcRenderer.invoke('update:set-auto', !!on),
    skip: (version) => ipcRenderer.invoke('update:skip', String(version)),
    onState: (cb) => {
      const h = (_e, s) => cb(s);
      ipcRenderer.on('update:state', h);
      return () => ipcRenderer.removeListener('update:state', h);
    }
  }
});
