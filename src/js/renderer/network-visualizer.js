const assert = require('assert');
const ops = require("ndarray-ops");

const shapes = {
    LINE: 0,
    SQUARE: 1,
    RECTANGLE: 2,
};

const layerShapes = [
    shapes.LINE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.SQUARE,
    shapes.RECTANGLE,
    shapes.RECTANGLE,
    shapes.LINE,
];

function getLayerDimensions(layer, shape) {
    switch (shape) {
        case shapes.LINE:
            return {layerWidth: 1, layerHeight: layer.shape[0]};
        case shapes.SQUARE:
            const sqrt = Math.ceil(Math.sqrt(layer.shape[0]));
            return {layerWidth: sqrt, layerHeight: sqrt};
        case shapes.RECTANGLE:
            const width = Math.ceil(Math.sqrt(layer.shape[0] / 4));
            const height = Math.ceil(layer.shape[0] / width);
            return {layerWidth: width, layerHeight: height};
    }
}

class NetworkVisualizer {
    constructor(canvas, options) {
        assert(typeof canvas !== "undefined");
        this._canvas = canvas;
        this._context = this._canvas.getContext('2d');

        if (typeof options === "undefined")
            options = {};

        this.layers = [];

        this.clearBeforeDrawing = typeof options.clearBeforeDrawing === "undefined" ? true : options.clearBeforeDrawing;
    }

    draw(timeSlot) {
        this._context.save();
        if (this.clearBeforeDrawing)
            this.clear();

        this._context.strokeStyle = `rgba(0, 0, 0, 1)`;

        const layersForTimeSlot = this.selectTimeSlot(timeSlot);

        console.log(layersForTimeSlot);

        let xStart = 1;
        let spacer = 10;
        const pixelSize = 3;
        for (let l = 0; l < layersForTimeSlot.length; ++l) {
            const layer = layersForTimeSlot[l];
            const {layerWidth, layerHeight} = getLayerDimensions(layer, layerShapes[l]);
            let neuronIndex = 0;
            const yStart = (this._canvas.height - layerHeight * pixelSize) / 2.0;
            const sup = Math.max(Number.EPSILON, ops.sup(layer));
            for (let x = 0; x < layerWidth && neuronIndex < layer.shape[0]; ++x) {
                for (let y = 0; y < layerHeight && neuronIndex < layer.shape[0]; ++y) {
                    const opacity = layer.get(neuronIndex) / sup;
                    this._context.fillStyle = `rgba(0,0,0,${opacity})`;
                    this._context.fillRect(
                        xStart + x * pixelSize,
                        yStart + y * pixelSize,
                        pixelSize, pixelSize
                    );
                    ++neuronIndex;
                }
                this._context.strokeRect(xStart - 1, yStart - 1, layerWidth * pixelSize + 1, layerHeight * pixelSize + 1);
            }
            xStart += pixelSize * layerWidth + spacer;
        }

        this._context.restore();
    }

    selectTimeSlot(timeSlot) {
        return this.layers.map(l => l.pick(timeSlot));
    }

    clear() {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
}

module
    .exports = NetworkVisualizer;
