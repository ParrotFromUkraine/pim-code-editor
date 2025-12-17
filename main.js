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
const platform = process.platform;

function createWin() {
    const isMac = platform === 'darwin';
    
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        frame: !isMac,
        titleBarStyle: isMac ? 'hiddenInset' : 'default',
        webPreferences: {
            preload: path.join(__dirname, 'electronPreload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
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

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
});

ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'JavaScript', extensions: ['js', 'jsx'] },
            { name: 'Python', extensions: ['py'] },
            { name: 'HTML', extensions: ['html'] },
            { name: 'CSS', extensions: ['css'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'TypeScript', extensions: ['ts', 'tsx'] },
            { name: 'Rust', extensions: ['rs'] },
            { name: 'Go', extensions: ['go'] },
            { name: 'SQL', extensions: ['sql'] },
            { name: 'Markdown', extensions: ['md'] }
        ]
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

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Error writing file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-file-dialog', async (event, defaultFileName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultFileName || 'untitled.txt',
        filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'JavaScript', extensions: ['js', 'jsx'] },
            { name: 'Python', extensions: ['py'] },
            { name: 'HTML', extensions: ['html'] },
            { name: 'CSS', extensions: ['css'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'TypeScript', extensions: ['ts', 'tsx'] },
            { name: 'Rust', extensions: ['rs'] },
            { name: 'Go', extensions: ['go'] },
            { name: 'SQL', extensions: ['sql'] },
            { name: 'Markdown', extensions: ['md'] }
        ]
    });
    return result.filePath || null;
});

ipcMain.handle('get-platform', () => {
    return platform;
});

// Window control for Windows
ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('window-close', () => {
    mainWindow.close();
});