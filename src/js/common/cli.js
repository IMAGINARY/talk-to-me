try {
    const electron = require("electron");
    if (electron.remote) {
        // If running in Electron renderer process, delegate to Electrons main process via Electron remote.
        module.exports = electron.remote.require(__filename);
        return;
    } else {
        // If running in Electron main process, proceed like with regular nodejs modules.
    }
} catch (err) {
    // If there is no Electron module, there is nothing to do.
}

const yargs = require('yargs');
const argv = yargs
    .option('fullscreen', {
        alias: 'f',
        type: 'number',
        default: true,
        description: 'Run in fullscreen mode. The window will be moved to the given display, if provided.',
    })
    .option('display', {
        type: 'number',
        description: 'Move the window to the given (system dependent) display.'
    })
    .option('kiosk', {
        type: 'boolean',
        default: false,
        description: 'Run in kiosk mode (caution: it might be difficult to quit the app).',
    })
    .option('menu', {
        type: 'boolean',
        default: false,
        description: 'Enable a menu and certain shortcuts useful for debugging.'
    })
    .option('demo', {
        type: 'boolean',
        default: false,
        description: 'Load a demo audio file.'
    })
    .version()
    .argv;

module.exports = {argv: argv};
