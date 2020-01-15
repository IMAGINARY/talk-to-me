const ops = require('ndarray-ops');
const colormap = require('colormap');

// maps a value between 0 and 1 to RGB color array
const heatmap = (() => {
    const palette = colormap({
        colormap: 'hot',
        nshades: 256,
        format: 'rgba',
        alpha: 1
    }).reverse();

    // map (0, 1) range for alpha to (0, 255)
    palette.forEach(c => c[3] = c[3] * 255);

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

function convertToCanvasImageSource(logMelSpectrogramData) {
    // TODO: avoid creating a new canvas every time
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    const min = ops.inf(logMelSpectrogramData);
    const max = ops.sup(logMelSpectrogramData);
    const range = Math.max(max - min, Number.EPSILON);

    const imageData = tempCtx.createImageData(logMelSpectrogramData.shape[0], logMelSpectrogramData.shape[1]);
    for (let y = 0; y < imageData.height; ++y) {
        for (let x = 0; x < imageData.width; ++x) {
            const value = logMelSpectrogramData.get(x, y);
            const normalizedValue = (value - min) / range;
            const color = alphamap(normalizedValue);
            imageData.data.set(color, 4 * (y * imageData.width + x));
        }
    }
    tempCtx.putImageData(imageData, 0, 0);

    return tempCanvas;
}

class SpectrogramVisualizer {
    constructor(canvas, options) {
        assert(typeof canvas !== "undefined");
        this._canvas = canvas;
        this._context = this._canvas.getContext('2d');

        if (typeof options === "undefined")
            options = {};

        this.clearBeforeDrawing = typeof options.clearBeforeDrawing === "undefined" ? true : options.clearBeforeDrawing;
    }

    draw(logMelSpectrogramData) {
        this._context.save();
        this._context.imageSmoothingEnabled = false;
        if (this.clearBeforeDrawing)
            this.clear();
        const xScale = this._canvas.width / logMelSpectrogramData.shape[0];
        const yScale = this._canvas.height / logMelSpectrogramData.shape[1];
        this._context.translate(0, this._canvas.height);
        this._context.scale(xScale, -yScale);
        this._context.drawImage(convertToCanvasImageSource(logMelSpectrogramData), 0, 0);
        this._context.restore();
    }

    clear() {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
}

module.exports = SpectrogramVisualizer;
