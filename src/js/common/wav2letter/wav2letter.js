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
    await steve.registerMethod('predict', `require('${workerPath}').predict`);
    await steve.registerMethod('predictExt', `require('${workerPath}').predictExt`);
    return steve;
}

const stevePromise = setupSteve();

module.exports = {
    transcribe: async params => (await stevePromise).getExecutor().transcribe(params),
    unload: async params => (await stevePromise).getExecutor().unload(params),
    predict: async params => (await stevePromise).getExecutor().predict(params),
    predictExt: async params => (await stevePromise).getExecutor().predictExt(params),
    shutdown: steve.shutdown.bind(steve),
    terminate: steve.terminate.bind(steve),
};
