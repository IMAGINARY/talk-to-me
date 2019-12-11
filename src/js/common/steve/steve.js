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
 * Simple generator for job ids. Probably not very efficient when there are a lot of active jobs.
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
        this._jobPromises = new Map();
        this._worker = new Worker(path.resolve(__dirname, 'steve-worker.js'));
        this._worker.on('message', jobMessage => {
            const jobPromise = this._jobPromises.get(jobMessage.jobId);
            this._jobPromises.delete(jobMessage.jobId);
            this._idGenerator.revoke(jobMessage.jobId);
            if (jobMessage.isError) {
                jobPromise.reject(jobMessage.result);
            } else {
                jobPromise.resolve(jobMessage.result);
            }
        });
        this._worker.on('error', this._rejectAllJobsWithError.bind(this));
        this._worker.on('exit', (code) => {
            const err = new Error(`Worker stopped with exit code ${code}`);
            this._rejectAllJobsWithError(err);
        });
    }

    getExecutor() {
        return this._executor;
    }

    async _registerMethodInWorker(methodName, code) {
        await new Promise((resolve, reject) => {
            const jobId = this._idGenerator.generate();
            this._jobPromises.set(jobId, {resolve: resolve, reject: reject});
            this._worker.postMessage({jobId: jobId, methodName: methodName, data: code, registerMethod: true});
        });
    }

    async registerMethod(methodName, code) {
        await this._registerMethodInWorker(methodName, code);
        this._executor[methodName] = async data => await new Promise((resolve, reject) => {
            const jobId = this._idGenerator.generate();
            this._jobPromises.set(jobId, {resolve: resolve, reject: reject});
            this._worker.postMessage({jobId: jobId, methodName: methodName, data: data});
        });
    }

    shutdown() {
        this._worker.unref();
    }

    async terminate() {
        return await this._worker.terminate();
    }

    _rejectAllJobsWithError(err) {
        const jobPromisesTmp = Array.from(this._jobPromises.values());
        this._jobPromises.clear();
        this._idGenerator.clear();
        jobPromisesTmp.forEach(jobPromise => jobPromise.reject(err));
    };

}

module.exports = Steve;
