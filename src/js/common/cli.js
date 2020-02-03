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
const getI18Next = require('./i18n.js');

async function argv() {
    const i18next = await getI18Next();
    const t = i18next.getFixedT(null, 'cli');
    const argv = yargs
        .option('fullscreen', {
            alias: 'f',
            type: 'number',
            default: true,
            description: t('description.fullscreen'),
        })
        .option('kiosk', {
            type: 'boolean',
            default: false,
            description: t('description.kiosk'),
        })
        .option('menu', {
            type: 'boolean',
            default: false,
            description: t('description.menu'),
        })
        .option('demo', {
            type: 'boolean',
            default: false,
            description: t('description.demo'),
        })
        .version()
        .argv;
    return argv;
}

module.exports = {
    argv: async () => await argv(),
};
