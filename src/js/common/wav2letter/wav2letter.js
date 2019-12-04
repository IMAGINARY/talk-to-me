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

const assert = require('assert');
const path = require('path');
const {Worker, isMainThread} = require('worker_threads');

assert(isMainThread, "Can not load this module in worker thread");

let transcriber = getTranscriber();

function getTranscriber() {
    const queue = [];

    const worker = new Worker(path.resolve(__dirname, 'worker.js'));
    worker.on('message', transcription => queue.shift().resolve(transcription));
    worker.on('error', err => queue.shift().reject(err));
    worker.on('exit', (code) => {
        const err = new Error(`Worker stopped with exit code ${code}`);
        queue.forEach(callback => callback.reject(err));
    });

    const transcribe = async params => await new Promise((resolve, reject) => {
        queue.push({resolve: resolve, reject: reject});
        worker.postMessage({method: 'transcribe', data: params});
    });

    const unloadModel = async lang => worker.postMessage({method: 'unloadModel', data: lang});

    return {
        transcribe: transcribe,
        unloadModel: unloadModel,
        worker: worker,
        queue: queue
    };
}

async function transcribe(params) {
    return await transcriber.transcribe(params);
}

function shutdown() {
    transcriber.worker.unref();
}

async function terminate() {
    return await transcriber.worker.terminate();
}

function unload(lang) {
    transcriber.unloadModel(lang);
}

module.exports = {transcribe: transcribe, shutdown: shutdown, terminate: terminate, unload: unload};
