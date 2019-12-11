const {parentPort} = require('worker_threads');

const methods = {};

function reportTaskResult(taskId, methodName, result) {
    parentPort.postMessage({taskId: taskId, method: methodName, isError: false, result: result});

}

function reportTaskError(taskId, methodName, error) {
    parentPort.postMessage({taskId: taskId, method: methodName, isError: true, result: error});
}

async function selectAndExecuteTask(methodName, data) {
    if (typeof methods[methodName] !== 'undefined') {
        return await methods[methodName](data);
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
            const taskResult = await selectAndExecuteTask(message.methodName, message.data);
            reportTaskResult(message.taskId, message.methodName, taskResult);
        } else {
            // register a new method
            await registerMethod(message.methodName, message.data);
            reportTaskResult(message.taskId, message.methodName);
        }
    } catch (err) {
        reportTaskError(message.taskId, message.methodName, err);
    }
}

parentPort.on('message', processMessage);
