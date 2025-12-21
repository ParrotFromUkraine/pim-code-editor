    const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectFile: () => ipcRenderer.invoke('select-file'),
    readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
    saveFileDialog: (defaultFileName) => ipcRenderer.invoke('save-file-dialog', defaultFileName),
    getFileSize: (path) => ipcRenderer.invoke('get-file-size', path),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close')
});
