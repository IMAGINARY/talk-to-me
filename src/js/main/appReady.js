const {BrowserWindow, ipcMain} = require('electron');
const path = require('path');

function createWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.webContents.openDevTools();

    // and load the index.html of the app.
    win.loadFile(path.resolve(__dirname, '../../html/index.html'));

    return win;
}

let win;

function appReady() {
    win = createWindow();
}

module.exports = appReady;
