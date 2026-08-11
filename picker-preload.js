const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenPicker', {
  onSources: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('screen-picker:sources', (_event, sources) => callback(sources));
  },
  selectSource: (sourceId) => {
    ipcRenderer.send('screen-picker:select', sourceId);
  }
});
