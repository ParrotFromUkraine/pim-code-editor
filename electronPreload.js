    const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    getFileSize: (path) => ipcRenderer.invoke('get-file-size', path)
});
