const util = require('./util.js');

function coercePredictResult(remotePrediction) {
    const prediction = Object.assign({}, remotePrediction);
    prediction.letterActivations = util.ndDataToNDArray(remotePrediction.letterActivations);
    return prediction;
}

function coercePredictExtResult(remotePrediction) {
    const prediction = Object.assign({}, remotePrediction);
    prediction.layers = remotePrediction.layers.map(util.ndDataToNDArray);
    return prediction;
}

try {
    const electron = require("electron");
    if (electron.remote) {
        // If running in Electron renderer process, delegate to Electrons main process via Electron remote.
        const remoteExports = electron.remote.require(__filename);
        module.exports = Object.assign({}, remoteExports);
        module.exports.predict = async (...args) => coercePredictResult(await remoteExports.predict(...args));
        module.exports.predictExt = async (...args) => coercePredictExtResult(await remoteExports.predictExt(...args));
        module.exports.decoder = require("./decoder.js");
        return;
    } else {
        // If running in Electron main process, proceed like with regular nodejs modules.
    }
} catch (err) {
    // If there is no Electron module, there is nothing to do.
}

// disable worker threads until Electron supports loading files from ASAR archives from within worker threads
const useWorkerThread = false;
if (useWorkerThread) {
    const path = require('path');
    const Steve = require('../steve/steve.js');

    const workerPath = path.resolve(__dirname, 'worker.js');
    const steve = new Steve();

    async function setupSteve() {
        const workerModule = `require(${JSON.stringify(workerPath)})`;
        await steve.registerMethod('transcribe', workerModule + ".transcribe");
        await steve.registerMethod('unload', workerModule + ".unloadModel");
        await steve.registerMethod('computeOutputLength', workerModule + ".computeOutputLength");
        await steve.registerMethod('predict', workerModule + ".predict");
        await steve.registerMethod('predictExt', workerModule + ".predictExt");
        return steve;
    }

    const stevePromise = setupSteve();

    module.exports = {
        transcribe: async params => (await stevePromise).getExecutor().transcribe(params),
        unload: async params => (await stevePromise).getExecutor().unload(params),
        computeOutputLength: async params => await (await stevePromise).getExecutor().computeOutputLength(params),
        predict: async params => coercePredictResult(await (await stevePromise).getExecutor().predict(params)),
        predictExt: async params => coercePredictExtResult(await (await stevePromise).getExecutor().predictExt(params)),
        decoder: require("./decoder.js"),
        shutdown: steve.shutdown.bind(steve),
        terminate: steve.terminate.bind(steve),
    };
} else {
    const worker = require('./worker.js');

    module.exports = {
        transcribe: worker.transcribe,
        unload: worker.unload,
        computeOutputLength: worker.computeOutputLength,
        predict: worker.predict,
        predictExt: worker.predictExt,
        decoder: require("./decoder.js"),
        shutdown: () => {
        },
        terminate: () => {
        },
    };
}
