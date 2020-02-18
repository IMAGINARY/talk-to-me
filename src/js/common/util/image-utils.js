const assert = require('assert');
const ops = require("ndarray-ops");
const colormap = require('colormap');

/**
 * Converts a 2D ndarray into a CanvasImageSource using a color map.
 * @param data2D {ndarray} A two-dimensional array.
 * @param colormap {function} Function that maps a float value in [0, 1] to a RGBA {uint8} array.
 * @param {boolean|function} [options.normalize=false] Normalize the values before color mapping.
 *      If {false}, no normalization is applied.
 *      If {true}, the range [min, max] is linearly mapped to [0, 1].
 *      Otherwise the argument will be assumed to be a function {Number} -> {Number} that computes the normalization.
 * @param {boolean} [options.flipH=false] Flip the image horizontally within the viewport.
 * @param {boolean} [options.flipV=false] Flip the image vertically within the viewport.
 * @param {boolean} [options.transpose=false] Transpose the data before drawing.
 * @returns {CanvasImageSource}
 */
function convert2DArrayToCanvasImageSource(data2D, colormap, options) {
    assert(data2D.shape.length === 2, "ndarray must be two-dimensional.");
    assert(data2D.shape[0] > 0 && data2D.shape[1] > 0, "ndarray dimensions must be >= 0");

    const defaultOptions = {
        normalize: false,
        flipH: false,
        flipV: false,
        transpose: false,
    };

    options = Object.assign(defaultOptions, options);

    const canvas = document.createElement("canvas");
    canvas.width = data2D.shape[0];
    canvas.height = data2D.shape[1];
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;

    // transpose
    if (options.transpose)
        data2D = data2D.transpose(1, 0);

    // normalize
    let normalizeFunc;
    if (typeof options.normalize === "boolean") {
        if (options.normalize) {
            // default normalization function: map [min, max] range to [0, 1]
            const min = ops.inf(data2D);
            const max = ops.sup(data2D);
            const range = Math.max(max - min, Number.EPSILON);
            normalizeFunc = v => (v - min) / range;
        } else {
            // do not normalize: use identify function
            normalizeFunc = v => v;
        }
    } else {
        assert(typeof options.normalize === "function", "Normalization function required.")
        normalizeFunc = options.normalize;
    }

    // flipX
    const mapIndexX = options.flipH ? x => data2D.shape[0] - 1 - x : x => x;

    // flipY
    const mapIndexY = options.flipV ? y => data2D.shape[1] - 1 - y : y => y;

    const imageData = context.createImageData(data2D.shape[0], data2D.shape[1]);

    for (let y = 0; y < imageData.height; ++y) {
        for (let x = 0; x < imageData.width; ++x) {
            const value = data2D.get(mapIndexX(x), mapIndexY(y));
            const normalizedValue = normalizeFunc(value);
            const color = colormap(normalizedValue);
            imageData.data.set(color, 4 * (y * imageData.width + x));
        }
    }
    context.putImageData(imageData, 0, 0);

    return canvas;
}

/**
 * Converts a 2D ndarray into a HTMLCanvasElement using a color map.
 * @param data2D {ndarray} A two-dimensional array.
 * @param colormap {function} Function that maps a float value in [0, 1] to a RGBA {uint8} array.
 * @param {boolean|function} [options.normalize=false] Normalize the values before color mapping.
 *      If {false}, no normalization is applied.
 *      If {true}, the range [min, max] is linearly mapped to [0, 1].
 *      Otherwise the argument will be assumed to be a function {Number} -> {Number} that computes the normalization.
 * @param {boolean} [options.flipH=false] Flip the image horizontally within the viewport.
 * @param {boolean} [options.flipV=false] Flip the image vertically within the viewport.
 * @param {boolean} [options.transpose=false] Transpose the data before drawing.
 * @returns {HTMLCanvasElement}
 */
function convert2DArrayToCanvas(data2D, colormap, options) {
    // For now this is just a pass-through function, because convert2DArrayToCanvasImageSource already returns a
    // HTMLCanvasElement. But when the implementation of convert2DArrayToCanvasImageSource changes to return some other
    // subtype of CanvasImageSource, this wrapper needs to be adjusted.
    return convert2DArrayToCanvasImageSource(data2D, colormap, options);
}

/**
 * Converts the given 2D ndarray into an image using a color map and draws onto the supplied canvas.
 * @param data2D {ndarray} A two-dimensional array.
 * @param colormap {function} Function that maps a float value in [0, 1] to a RGBA {uint8} array.
 * @param canvas {HTMLCanvasElement} The HTMLCanvasElement to draw to.
 * @param {Object} [options] Optional configuration of the draw command.
 * @param {{x: number, y: number, width: number, height: number}} [options.viewport={x: 0, y: 0, width: canvas.width, height: canvas.height}] The canvas viewport to draw the data to.
 * @param {boolean} [options.isImageimageSmoothingEnabled=false] Smooth the data when scaling up or down.
 * @param {boolean} [options.clearBeforeDrawing=false] Clear the viewport before drawing.
 * @param {boolean|function} [options.normalize=false] Normalize the values before color mapping.
 *      If {false}, no normalization is applied.
 *      If {true}, the range [min, max] is linearly mapped to [0, 1].
 *      Otherwise the argument will be assumed to be a function {Number} -> {Number} that computes the normalization.
 * @param {boolean} [options.flipH=false] Flip the image horizontally within the viewport.
 * @param {boolean} [options.flipV=false] Flip the image vertically within the viewport.
 * @param {boolean} [options.transpose=false] Transpose the data before drawing.
 * @returns {HTMLCanvasElement} The input canvas.
 */
function draw2DArrayToCanvas(data2D, colormap, canvas, options) {
    const context = canvas.getContext("2d");

    const defaultOptions = {
        imageSmoothingEnabled: false,
        viewport: {x: 0, y: 0, width: canvas.width, height: canvas.height},
        clearBeforeDrawing: false,
        flipH: false,
        flipV: false,
        transpose: false,
    };

    options = Object.assign(defaultOptions, options);

    const viewport = options.viewport;

    context.save();

    context.imageSmoothingEnabled = options.imageSmoothingEnabled;
    if (options.clearBeforeDrawing)
        context.clearRect(viewport.x, viewport.y, viewport.width, viewport.height);
    const xScale = viewport.width / data2D.shape[0];
    const yScale = viewport.height / data2D.shape[1];
    context.translate(viewport.x, viewport.y);
    context.scale(xScale, yScale);

    const imageSource = convert2DArrayToCanvasImageSource(data2D, colormap, options);
    context.drawImage(imageSource, 0, 0);

    context.restore();

    return canvas;
}

/**
 * Clear the entire canvas.
 * @param canvas
 */
function clearCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
}

// maps a value between 0 and 1 to RGB color array
const heatmap = (() => {
    const palette = colormap({
        colormap: 'hot',
        nshades: 256,
        format: 'rgba',
        alpha: 1
    }).reverse();

    // map [0, 1] range for alpha to [0, 255]
    palette.forEach(c => c[3] = Math.round(c[3] * 255));

    return value => {
        const constrainedValue = value < 0.0 ? 0.0 : (value > 1.0 ? 1.0 : value);
        const index = Math.floor(255 * constrainedValue);
        return palette[index];
    };
})();

const alphamap = (() => {
    const palette = Array.from({length: 256}, (_, i) => [0, 0, 0, i]);
    return value => {
        const constrainedValue = value < 0.0 ? 0.0 : (value > 1.0 ? 1.0 : value);
        const index = Math.floor(255 * constrainedValue);
        return palette[index];
    };
})();

const alphamapForRgba = (rgbaColor) => {
    const forAlpha = alpha => {
        const result = Array.from(rgbaColor);
        result[3] = result[3] * (alpha / 255);
        return result;
    };
    const palette = Array.from({length: 256}, (_, i) => forAlpha(i));
    return value => {
        const constrainedValue = value < 0.0 ? 0.0 : (value > 1.0 ? 1.0 : value);
        const index = Math.floor(255 * constrainedValue);
        return palette[index];
    };
};

module.exports = {
    convert2DArrayToCanvasImageSource: convert2DArrayToCanvasImageSource,
    convert2DArrayToCanvas: convert2DArrayToCanvas,
    draw2DArrayToCanvas: draw2DArrayToCanvas,
    clearCanvas: clearCanvas,
    heatmap: heatmap,
    alphamap: alphamap,
    alphamapForRgba: alphamapForRgba,
};
