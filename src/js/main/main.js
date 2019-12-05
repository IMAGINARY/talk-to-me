const {app} = require('electron')
const path = require('path');
require('electron-reload')(path.join(__dirname, '../..'));


const appReady = require("./appReady.js");

app.on('ready', appReady);
