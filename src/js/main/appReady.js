const {BrowserWindow, Menu, screen} = require('electron');
const path = require('path');

const cli = require('../common/cli.js');

function createWindow(argv) {
    console.log("creating window");

    const options = {
        fullscreen: argv.fullscreen !== false,
        kiosk: argv.kiosk,
        webPreferences: {
            nodeIntegration: true
        }
    };

    if (typeof argv.fullscreen === "number") {
        const displays = screen.getAllDisplays();
        const display = displays[Math.min(Math.max(0, argv.fullscreen), displays.length - 1)];
        const bounds = display.bounds;
        Object.assign(options, bounds);
    }

    // Create the browser window.
    const win = new BrowserWindow(options);

    if (!argv.menu) {
        // remove the menu bar
        Menu.setApplicationMenu(null);
        win.setMenu(null);
    }

    // and load the index.html of the app.
    win.loadFile(path.resolve(__dirname, '../../html/index.html'));

    return win;
}

let win;

function appReady(argv) {
    console.log("creating window");

    win = createWindow(argv);
}

module.exports = appReady;
