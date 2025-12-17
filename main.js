const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Helpful guard: running this file with plain `node` will produce
// "app.whenReady is not a function" because Electron APIs aren't present.
// Exit early with a clear message when not executed inside Electron.
if (!process.versions || !process.versions.electron) {
    console.error('Error: This app must be run with Electron, not Node.');
    console.error('Run: npx electron .   or   npm start');
    process.exit(1);
}

let mainWindow;

function createWin() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'electronPreload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    })
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWin();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWin();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers for file system operations
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
});

ipcMain.handle('read-directory', async (event, folderPath) => {
    try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true });
        return files.map(file => ({
            name: file.name,
            path: path.join(folderPath, file.name),
            isDirectory: file.isDirectory(),
            isFile: file.isFile()
        })).sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return b.isDirectory - a.isDirectory;
            }
            return a.name.localeCompare(b.name);
        });
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        console.error('Error reading file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-file-size', async (event, filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
});