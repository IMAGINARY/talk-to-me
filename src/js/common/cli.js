const processArgv = [...process.argv];
try {
    const electron = require("electron");
    if (electron.remote) {
        // If running in Electron renderer process, delegate to Electrons main process via Electron remote.
        module.exports = electron.remote.require(__filename);
        return;
    } else {
        // If running in Electron main process, proceed like with regular nodejs modules.
        if (!electron.app.isPackaged)
            // Needed for proper parsing in packaged and non-packaged mode.
            // See https://yargs.js.org/docs/#api-argv
            processArgv.splice(1, 1);
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
            default: false,
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
        .option('volume-threshold', {
            type: 'number',
            default: -50,
            description: t('description.volumeThreshold'),
        })
        .option('idle-timeout', {
            type: 'number',
            default: 5 * 60,
            description: t('description.idleTimeout'),
        })
        .option('hide-play-button', {
            type: 'boolean',
            default: false,
            description: t('description.hidePlayButton'),
        })
        .option('lang', {
            type: 'string',
            default: i18next.language,
            description: t('description.lang'),
        })
        .option('auto', {
            type: 'boolean',
            default: false,
            description: t('description.autoStart'),
        })
        .option('turbo', {
            alias: 't',
            type: 'boolean',
            default: false,
            description: t('description.turbo'),
        })
        .version()
        .parse(processArgv);

    argv.initialLang = argv.lang;
    argv.initialAuto = argv.auto;
    argv.initialTurbo = argv.turbo;
    return argv;
}

const argvPromise = argv();

module.exports = {
    argv: async () => await argvPromise,
};
