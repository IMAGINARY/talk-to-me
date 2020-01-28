const assert = require('assert');
const ImageUtils = require('../common/util/image-utils.js');

class SpectrogramVisualizer {
    constructor(canvas, options) {
        assert(typeof canvas !== "undefined");
        this._canvas = canvas;
        this._context = this._canvas.getContext('2d');

        if (typeof options === "undefined")
            options = {};

        this._drawOptions = {
            clearBeforeDrawing: typeof options.clearBeforeDrawing === "undefined" ? true : options.clearBeforeDrawing,
            flipV: true,
        };
    }

    draw(logMelSpectrogramData) {
        ImageUtils.draw2DArrayToCanvas(logMelSpectrogramData, ImageUtils.alphamap, this._canvas, this._drawOptions);
    }

    clear() {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
}

module.exports = SpectrogramVisualizer;
