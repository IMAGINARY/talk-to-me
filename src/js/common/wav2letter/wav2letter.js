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

const path = require('path');
const Steve = require('../steve/steve.js');

const workerPath = path.resolve(__dirname, 'worker.js');
const steve = new Steve();

async function setupSteve() {
    await steve.registerMethod('transcribe', `require('${workerPath}').transcribe`);
    await steve.registerMethod('unload', `require('${workerPath}').unloadModel`);
    return steve;
}

const stevePromise = setupSteve();

async function transcribe(params) {
    const steve = await stevePromise;
    return await steve.getExecutor().transcribe(params);
}

async function unload(lang) {
    const steve = await stevePromise;
    await steve.getExecutor().unload(lang);
}

module.exports = {
    transcribe: transcribe,
    shutdown: steve.shutdown.bind(steve),
    terminate: steve.terminate.bind(steve),
    unload: unload
};
