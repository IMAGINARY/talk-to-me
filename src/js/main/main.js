const cli = require('../common/cli.js');

let gcSentinel;

async function main(argv) {
    if (argv.help || argv.version)
        return; // prevent electron stuff from being loaded (otherwise windows might pop up for --help and --version)

    const {app} = require('electron')
    const path = require('path');
    require('electron-reload')(path.join(__dirname, '../..'));

    const wav2letter = require("../common/wav2letter/wav2letter.js");

    const appReady = require("./appReady.js");

    app.on('window-all-closed', async () => {
        await wav2letter.terminate();
        app.quit();
    });

    await app.whenReady();
    appReady(argv);

    gcSentinel = {
        app: app,
        wav2letter: wav2letter,
    };
}

cli.argv()
    .then(main);
