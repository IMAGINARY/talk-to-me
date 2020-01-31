const assert = require('assert');
const ops = require("ndarray-ops");

class TranscriptionVisualizer {
    constructor(canvas, options) {
        assert(typeof canvas !== "undefined");
        this._canvas = canvas;
        this._context = this._canvas.getContext('2d');

        if (typeof options === "undefined")
            options = {};

        this.clearBeforeDrawing = typeof options.clearBeforeDrawing === "undefined" ? true : options.clearBeforeDrawing;
    }

    draw(indices, probabilities, alphabet, numBest, cellWidth, fontSizePx) {
        this._context.save();

        this._canvas.width = indices.shape[0] * cellWidth;
        this._canvas.height = fontSizePx * ( numBest + 0.25 );

        if (this.clearBeforeDrawing)
            this.clear();

        this._context.font = `${fontSizePx}px Inconsolata`;
        this._context.textAlign = "center";

        const lineHeight = fontSizePx;
        const charWidth = this._canvas.width / indices.shape[0];
        for (let position = 0; position < indices.shape[0]; ++position) {
            const bestK = indices.pick(position).hi(numBest);
            for (let lineNum = 0; lineNum < bestK.shape[0]; ++lineNum) {
                const charIndex = bestK.get(lineNum);
                const char = alphabet[charIndex];
                const opacity = probabilities.get(position, charIndex);
                this._context.fillStyle = `rgba(0,0,0,${opacity})`;
                this._context.fillText(char, (position + 0.5) * charWidth, lineHeight * (numBest - lineNum));
            }
        }

        this._context.restore();
    }

    clear() {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
}

module.exports = TranscriptionVisualizer;
