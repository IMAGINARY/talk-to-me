const {BrowserWindow, Menu, screen} = require('electron');
const path = require('path');

const isPackaged = require('../common/is-packaged.js');

function createWindow(argv) {
    const options = {
        width: 1280,
        height: 720,
        useContentSize: true,
        kiosk: argv.kiosk,
        webPreferences: {
            nodeIntegration: true
        }
    };

    if (argv.fullscreen === true)
        options.fullscreen = true;

    if (typeof argv.fullscreen === "number") {
        options.fullscreen = true;
        const displays = screen.getAllDisplays();
        const display = displays[Math.min(Math.max(0, argv.fullscreen), displays.length - 1)];
        const bounds = display.bounds;
        Object.assign(options, bounds);
    }

    if (process.platform === 'linux')
        options.icon = path.resolve(__dirname, isPackaged() ? ".." : "", "../../../build/fallbackicon.png");

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
    win = createWindow(argv);
}

module.exports = appReady;
