const cli = require('../common/cli.js');

const {app} = require('electron')
const path = require('path');
require('electron-reload')(path.join(__dirname, '../..'));

const wav2letter = require("../common/wav2letter/wav2letter.js");

const appReady = require("./appReady.js");

app.on('ready', () => appReady(cli.argv));

app.on('window-all-closed', async () => {
    await wav2letter.terminate();
    app.quit();
});
