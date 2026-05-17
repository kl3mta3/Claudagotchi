const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splash', {
  onStatus: (cb) => ipcRenderer.on('splash-status', (_, payload) => cb(payload)),
  retry:    ()  => ipcRenderer.invoke('splash-retry'),
  skip:     ()  => ipcRenderer.invoke('splash-skip'),
  quit:     ()  => ipcRenderer.invoke('splash-quit'),
});
