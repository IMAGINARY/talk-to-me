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

class Steve {
    constructor() {
        this._executor = {};
        this._idGenerator = new IdGenerator();
        this._taskPromises = new Map();
        this._worker = new Worker(path.resolve(__dirname, 'steve-worker.js'));
        this._worker.on('message', taskMessage => {
            const taskPromise = this._taskPromises.get(taskMessage.taskId);
            this._taskPromises.delete(taskMessage.taskId);
            this._idGenerator.revoke(taskMessage.taskId);
            if (taskMessage.isError) {
                taskPromise.reject(taskMessage.result);
            } else {
                taskPromise.resolve(taskMessage.result);
            }
        });
        this._worker.on('error', this._rejectAllTasksWithError.bind(this));
        this._worker.on('exit', (code) => {
            const err = new Error(`Worker stopped with exit code ${code}`);
            this._rejectAllTasksWithError(err);
        });
    }

    getExecutor() {
        return this._executor;
    }

    async _registerMethodInWorker(methodName, code) {
        await new Promise((resolve, reject) => {
            const taskId = this._idGenerator.generate();
            this._taskPromises.set(taskId, {resolve: resolve, reject: reject});
            this._worker.postMessage({taskId: taskId, methodName: methodName, data: code, registerMethod: true});
        });
    }

    async registerMethod(methodName, code) {
        await this._registerMethodInWorker(methodName, code);
        this._executor[methodName] = async data => await new Promise((resolve, reject) => {
            const taskId = this._idGenerator.generate();
            this._taskPromises.set(taskId, {resolve: resolve, reject: reject});
            this._worker.postMessage({taskId: taskId, methodName: methodName, data: data});
        });
    }

    shutdown() {
        this._worker.unref();
    }

    async terminate() {
        return await this._worker.terminate();
    }

    _rejectAllTasksWithError(err) {
        const taskPromisesTmp = Array.from(this._taskPromises.values());
        this._taskPromises.clear();
        this._idGenerator.clear();
        taskPromisesTmp.forEach(taskPromise => taskPromise.reject(err));
    };

}

module.exports = Steve;
