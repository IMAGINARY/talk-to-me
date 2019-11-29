const {app} = require('electron')

const appReady = require("./appReady.js");

app.on('ready', appReady);
