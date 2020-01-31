const MIN_AMPLITUDE = 0.1;

class WaveformVisualizer {
    constructor(canvas, samples) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.samples = samples;
        this.samples.on('empty', () => this._clear());
        this.samples.on('data', (data, newLength, oldLength) => this._receiveSamples(data, oldLength));
        this.buckets = new Float32Array(this.canvas.width);

        this._requestAnimationFrameCB = this._redraw.bind(this);

        const callback = (mutationsList, observer) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'width') {
                    requestAnimationFrame(this._requestAnimationFrameCB);
                    break;
                }
            }
        };
        this._observer = new MutationObserver(callback);
        this._observer.observe(this.canvas, {attributes: true});
    }

    _clear() {
        this.buckets.fill(0.0);
        requestAnimationFrame(this._requestAnimationFrameCB);
    }

    _receiveSamples(data, start) {
        for (let i = 0; i < data.length; ++i) {
            const bucketIndex = Math.floor(((start + i) / this.samples.maxLength) * this.buckets.length);
            this.buckets[bucketIndex] = Math.max(this.buckets[bucketIndex], Math.abs(data[i]));
        }
        requestAnimationFrame(this._requestAnimationFrameCB);
    }

    _redraw(timestampMs) {
        if (this.buckets.length != this.canvas.width) {
            this.buckets = new Float32Array(this.canvas.width);
            this._receiveSamples(this.samples.data.subarray(0, this.samples.length), 0);
        }

        // compute maximum aplitude
        const maxAmplitude = this.buckets.reduce((max, cur) => Math.max(max, Math.abs(cur)), MIN_AMPLITUDE);
        const amplification = 1.0 / maxAmplitude;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.translate(0, this.canvas.height / 2.0);
        this.ctx.strokeStyle = '#999';
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(this.canvas.width, 0.0);
        this.ctx.stroke();
        this.ctx.strokeStyle = '#000';
        const barWidth = this.canvas.width / this.buckets.length;
        for (let i = 0; i < this.buckets.length; ++i) {
            const barHeight = amplification * this.buckets[i] * this.canvas.height;
            this.ctx.fillRect(i / this.buckets.length * this.canvas.width, -0.5 * barHeight, barWidth, barHeight);
        }
        this.ctx.restore();
    }
}

module.exports = WaveformVisualizer;
