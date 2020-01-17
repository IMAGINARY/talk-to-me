const assert = require('assert');

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
        this._context.strokeRect(0, 0, this._canvas.width, this._canvas.height);

        const layersForTimeSlot = this.selectTimeSlot(timeSlot);

        for (let l = 0; l < layersForTimeSlot.length; ++l) {
            const layer = layersForTimeSlot[l];
            for (let n = 0; n < layer.shape[0]; ++n) {
                const opacity = layer.get(n);
                this._context.fillStyle = `rgba(0,0,0,${opacity})`;
                this._context.fillRect(20 * l, n, 10, 1);
            }
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

module.exports = NetworkVisualizer;
