const ndarray = require("ndarray");
const ops = require("ndarray-ops");
const pack = require("ndarray-pack");
const unpack = require("ndarray-unpack");
const cwise = require("cwise");

function argMax2D(a2D) {
    const result = ndarray(new Int32Array(a2D.shape[0]));
    for (let i = 0; i < result.shape[0]; ++i)
        result.set(i, ops.argmax(a2D.pick(i, null))[0]);
    return result;
}

function decodeGreedy(letterActivations) {
    const maxActivationIndices = argMax2D(letterActivations);
    return maxActivationIndices;
}

function decodeGreedyAll(letterActivations) {
    const sortedActivationIndices = Array(letterActivations.shape[0]);
    for (let i = 0; i < sortedActivationIndices.length; ++i) {
        const activationIndexPairs = unpack(letterActivations.pick(i, null)).map((v, i) => [v, i]);
        activationIndexPairs.sort((fstPair, sndPair) => sndPair[0] - fstPair[0]);
        sortedActivationIndices[i] = activationIndexPairs.map(pair => pair[1]);
    }
    const indexBuffer = new Int32Array(letterActivations.shape[0] * letterActivations.shape[1]);
    const resultNdArray = ndarray(indexBuffer, letterActivations.shape);
    return pack(sortedActivationIndices, resultNdArray);
}

const _indexToLetter = cwise({
    args: ["array", "array", "scalar"],
    body: function (result, index, letters) {
        result = letters[index];
    }
});

function indexToLetter(indices, letters) {
    const totalSize = indices.shape.reduce((acc, cur) => acc * cur, 1);
    const result = ndarray(Array(totalSize), indices.shape);
    _indexToLetter(result, indices, letters);
    return result;
}

module.exports = {
    decodeGreedy: decodeGreedy,
    decodeGreedyAll: decodeGreedyAll,
    indexToLetter: indexToLetter,
};
