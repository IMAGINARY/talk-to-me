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

function getTranscriber(lang) {
    if (typeof transcribers[lang] === "undefined") {
        const queue = [];

        const worker = new Worker(path.resolve(__dirname, 'worker.js'), {workerData: {lang: lang}});
        worker.on('message', transcription => queue.shift().resolve(transcription));
        worker.on('error', err => queue.shift().reject(err));
        worker.on('exit', (code) => {
            const err = new Error(`Worker stopped with exit code ${code}`);
            transcribers[lang].queue.forEach(callback => callback.reject(err));
            delete transcribers[lang];
        });

        const transcribe = async waveform => await new Promise((resolve, reject) => {
            queue.push({resolve: resolve, reject: reject});
            worker.postMessage(waveform);
        });

        transcribers[lang] = {transcribe: transcribe, worker: worker, queue: queue};
    }
    return transcribers[lang];
}

async function transcribe(params) {
    const lang = params.lang;
    const waveform16kHzFloat32 = params.waveform;
    return await getTranscriber(lang).transcribe(waveform16kHzFloat32);
}

function shutdown(lang, ...langs) {
    if (typeof lang !== 'undefined')
        langs.unshift(lang);
    const allLangs = Object.keys(transcribers);
    if (langs.length === 0)
        langs = allLangs;
    else
        langs = langs.filter(l => typeof allLangs[l] !== "undefined");
    langs.forEach(lang => transcribers[lang].worker.unref());
}

async function terminate(lang, ...langs) {
    if (typeof lang !== 'undefined')
        langs.unshift(lang);
    const allLangs = Object.keys(transcribers);
    if (langs.length === 0)
        langs = allLangs;
    else
        langs = langs.filter(l => typeof allLangs[l] !== "undefined");

    const promises = [];
    langs.forEach(lang => promises.push(transcribers[lang].worker.terminate()));
    return await Promise
        .all(promises)
        .then(exitCodes => exitCodes.reduce((exitCodeObj, v, i) => {
                exitCodeObj[langs[i]] = v;
                return exitCodeObj;
            }, {})
        );
}


module.exports = {transcribe: transcribe, shutdown: shutdown, terminate: terminate};
