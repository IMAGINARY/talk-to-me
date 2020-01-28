const assert = require('assert');
const ndarray = require("ndarray");
const ImageUtils = require('../common/util/image-utils.js');

const d3 = require('d3');
require('d3-selection-multi');

function visualizeLetterProbabilities(letterProbabilties, alphabet) {
    const cellSize = 11;

    const margin = {top: 1, right: cellSize, bottom: 1, left: cellSize},
        width = letterProbabilties.shape[0] * cellSize,
        height = letterProbabilties.shape[1] * cellSize,
        totalWidth = width + margin.left + margin.right,
        totalHeight = height + margin.top + margin.bottom;

    const base = d3.select("#letter-probabilities");
    const svg = base.append("svg")
        .attr("width", totalWidth)
        .attr("height", totalHeight);

    const diagram = svg.append("g")
        .attr("transform", `translate(${cellSize},1)`);

    const gridLines = diagram.append("g")
        .attr("class", "grid");

    const gridLinesX = gridLines.append("g");
    for (let x = 0; x <= letterProbabilties.shape[0]; ++x) {
        gridLinesX.append("line")
            .attrs({x1: x * cellSize, y1: 0, x2: x * cellSize, y2: height});
    }

    const gridLinesY = gridLines.append("g");
    for (let y = 0; y <= letterProbabilties.shape[1]; ++y) {
        gridLinesY.append("line")
            .attrs({x1: 0, y1: y * cellSize, x2: width, y2: y * cellSize});
    }

    for (let l = 0; l < letterProbabilties.shape[1]; ++l) {
        const char = alphabet[l];
        diagram.append("text")
            .attr("class", ".legend")
            .attrs({
                x: -0.5 * cellSize,
                y: (l + 1 - 0.25) * cellSize,
            })
            .text(char)
        for (let t = 0; t < letterProbabilties.shape[0]; ++t) {
            const opacity = letterProbabilties.get(t, l);
            diagram.append("rect")
                .attrs({
                    x: t * cellSize,
                    y: l * cellSize,
                    width: cellSize,
                    height: cellSize,
                    opacity: opacity,
                });
            diagram.append("text")
                .attr("class", "letters")
                .attrs({
                    x: (t + 0.5) * cellSize,
                    y: (l + 1 - 0.25) * cellSize,
                })
                .text(char)
        }
        diagram.append("text")
            .attr("class", ".legend")
            .attrs({
                x: (letterProbabilties.shape[0] + 0.5) * cellSize,
                y: (l + 1 - 0.25) * cellSize,
            })
            .text(char)
    }
}

class NetworkVisualizer {
    constructor(canvas, options) {
        assert(typeof canvas !== "undefined");
        this._canvas = canvas;
        this._context = this._canvas.getContext('2d');

        if (typeof options === "undefined")
            options = {};

        this._layers = [
            ndarray(new Float32Array(1), [1, 1]), // dummy input layer
            ndarray(new Float32Array(1), [1, 1]), // dummy output layer
        ];
        this._currentLayer = 0;

        this._drawOptions = {
            clearBeforeDrawing: typeof options.clearBeforeDrawing === "undefined" ? true : options.clearBeforeDrawing,
            flipV: true,
        };

        this._requestAnimationFrameCB = this.redraw.bind(this);

        let currentLayer = 0;
        this.scheduleRedraw();
    }

    get layers() {
        return this._layers;
    }

    set layers(layers) {
        assert(layers.length >= 2, "Network needs at least input and output layers");
        this._layers = layers;
        this._currentLayer = 0;
        // TODO: extends to allow other languages
        visualizeLetterProbabilities(this.layers[layers.length - 1], "␣'ABCDEFGHIJKLMNOPQRSTUVWXYZ²³·");
        this.scheduleRedraw();
    }

    set currentLayer(index) {
        assert(index >= 0 && index < this._layers.length, `Layer index is ${index}, but must be in the range [0, ${this._layers.length - 1}]`);
        if (this._currentLayer !== index) {
            this._currentLayer = index;
            this.scheduleRedraw();
        }
    }

    get currentLayer() {
        return this._currentLayer;
    }

    scheduleRedraw() {
        cancelAnimationFrame(this._requestAnimationFrameCB);
        requestAnimationFrame(this._requestAnimationFrameCB);
    }

    redraw() {
        if (this._layers.length > 0) {
            const layer = this.layers[this._currentLayer];
            ImageUtils.draw2DArrayToCanvas(layer, ImageUtils.alphamap, this._canvas, this._drawOptions);
        }
    }

    clear() {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
}

module
    .exports = NetworkVisualizer;
