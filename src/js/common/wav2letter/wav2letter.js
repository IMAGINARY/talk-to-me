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

const transcribers = {};

function createTranscriber(lang) {
    const queue = [];
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {workerData: {lang: lang}});
    worker.on('message', transcription => queue.shift().resolve(transcription));
    worker.on('error', err => queue.shift().reject(err));
    worker.on('exit', (code) => {
        if (code !== 0)
            queue.shift().reject(new Error(`Worker stopped with exit code ${code}`));
    });

    const transcribe = async waveform => await new Promise((resolve, reject) => {
        queue.push({resolve: resolve, reject: reject});
        worker.postMessage(waveform);
    });

    return {transcribe: transcribe, unref: () => worker.unref()};
}

async function transcribe(params) {
    const lang = params.lang;
    const waveform16kHzFloat32 = params.waveform;
    if (typeof transcribers[lang] === "undefined")
        transcribers[lang] = createTranscriber(lang);
    return await transcribers[lang].transcribe(waveform16kHzFloat32);
}

async function shutdown() {
    const languages = Object.keys(transcribers);
    languages.forEach(lang => {
        transcribers[lang].unref();
        delete transcribers[lang];
    });
}

module.exports = {transcribe: transcribe, shutdown: shutdown};
