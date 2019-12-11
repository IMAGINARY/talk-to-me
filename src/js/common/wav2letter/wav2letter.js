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

/***
 * Simple generator for task ids. Probably not very efficient when there are a lot of active tasks.
 */
class IdGenerator {
    constructor() {
        this.ids = []; // keep sorted
    }

    generate() {
        let slot = 0;
        for (; slot < this.ids.length && this.ids[slot] <= slot; ++slot) {
            // iteration stops at a free slot or at the end of the array
        }

        // insert the new id at the free slot
        this.ids.splice(slot, 0, slot);
        return slot;
    }

    revoke(id) {
        const slot = this.ids.indexOf(id);
        this.ids.splice(slot, 1);
    }

    clear() {
        this.ids.length = 0;
    }
}

let transcriber = getTranscriber();

function getTranscriber() {
    const idGenerator = new IdGenerator();
    const taskPromises = new Map();

    const rejectAllWithError = err => {
        const taskPromisesTmp = Array.from(taskPromises.values());
        taskPromises.clear();
        idGenerator.clear();
        taskPromisesTmp.forEach(taskPromise => taskPromise.reject(err));
    };

    const worker = new Worker(path.resolve(__dirname, 'worker.js'));
    worker.on('message', taskMessage => {
        const taskPromise = taskPromises.get(taskMessage.taskId);
        taskPromises.delete(taskMessage.taskId);
        idGenerator.revoke(taskMessage.taskId);
        if (taskMessage.isError) {
            taskPromise.reject(taskMessage.result);
        } else {
            taskPromise.resolve(taskMessage.result);
        }
    });
    worker.on('error', rejectAllWithError);
    worker.on('exit', (code) => {
        const err = new Error(`Worker stopped with exit code ${code}`);
        rejectAllWithError(err);
    });

    const createTaskExecutor = methodName => {
        return async data => await new Promise((resolve, reject) => {
            const taskId = idGenerator.generate();
            taskPromises.set(taskId, {resolve: resolve, reject: reject});
            worker.postMessage({taskId: taskId, methodName: methodName, data: data});
        });
    };

    return {
        transcribe: createTaskExecutor('transcribe'),
        unloadModel: createTaskExecutor('unloadModel'),
        worker: worker,
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

async function unload(lang) {
    await transcriber.unloadModel(lang);
}

module.exports = {transcribe: transcribe, shutdown: shutdown, terminate: terminate, unload: unload};
