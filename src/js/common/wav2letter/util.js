const ndarray = require("ndarray")

function ndDataToNDArray(ndDataStructure) {
    return ndarray(
        ndDataStructure.data,
        ndDataStructure.shape,
        ndDataStructure.stride,
        ndDataStructure.offset
    );
}

module.exports = {
    ndDataToNDArray: ndDataToNDArray,
};
