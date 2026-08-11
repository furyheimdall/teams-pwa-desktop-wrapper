const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__ntfBridge', {
  show: (title, options) => {
    ipcRenderer.send('show-notification', {
      title: typeof title === 'string' ? title : '',
      body: typeof options?.body === 'string' ? options.body : '',
      silent: options?.silent === true
    });
  }
});
