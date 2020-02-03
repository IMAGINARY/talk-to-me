const cli = require('../common/cli.js');

cli.argv().then(argv => main(argv));

function main(argv) {
    const {app} = require('electron')
    const path = require('path');
    require('electron-reload')(path.join(__dirname, '../..'));

    const wav2letter = require("../common/wav2letter/wav2letter.js");

    const appReady = require("./appReady.js");

    app.on('ready', async () => appReady(await cli.argv()));

    app.on('window-all-closed', async () => {
        await wav2letter.terminate();
        app.quit();
    });
}
