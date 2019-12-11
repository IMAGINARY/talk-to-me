const {parentPort} = require('worker_threads');

const methods = {};

function reportJobResult(jobId, methodName, result) {
    parentPort.postMessage({jobId: jobId, method: methodName, isError: false, result: result});

}

function reportJobError(jobId, methodName, error) {
    parentPort.postMessage({jobId: jobId, method: methodName, isError: true, result: error});
}

async function selectAndExecuteJob(methodName, args) {
    if (typeof methods[methodName] !== 'undefined') {
        return await methods[methodName](...args);
    } else {
        throw new Error("Unknown method: " + methodName);
    }
}

async function registerMethod(methodName, code) {
    const method = await eval(code);
    methods[methodName] = method;
}

async function processMessage(message) {
    try {
        if (typeof message.registerMethod === 'undefined') {
            // this is a regular message call
            const jobResult = await selectAndExecuteJob(message.methodName, message.args);
            reportJobResult(message.jobId, message.methodName, jobResult);
        } else {
            // register a new method
            await registerMethod(message.methodName, message.args[0]);
            reportJobResult(message.jobId, message.methodName);
        }
    } catch (err) {
        reportJobError(message.jobId, message.methodName, err);
    }
}

parentPort.on('message', processMessage);
