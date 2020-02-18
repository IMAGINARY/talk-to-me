const MIN_AMPLITUDE = 0.1;

class WaveformVisualizer {
    constructor(canvas, samples) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.samples = samples;
        this.samples.on('empty', () => this._clear());
        this.samples.on('data_changed', (data, start, end) => this._receiveSamples(start, end));
        this.buckets = new Float32Array(this.canvas.width);

        this._cursorPosition = 0.0;

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

    get cursorPosition() {
        return this._cursorPosition;
    }

    set cursorPosition(pos) {
        this._cursorPosition = pos;
        requestAnimationFrame(this._requestAnimationFrameCB);
    }

    _clear() {
        this.buckets.fill(0.0);
        requestAnimationFrame(this._requestAnimationFrameCB);
    }

    _bucketIndex(sampleIndex) {
        return Math.floor((sampleIndex / this.samples.maxLength) * this.buckets.length);
    }

    _receiveSamples(sampleStart, sampleEnd) {
        const bucketStart = this._bucketIndex(sampleStart);
        const bucketEnd = this._bucketIndex(sampleEnd);

        // clear buckets that will be refilled
        for (let b = bucketStart; b < bucketEnd; ++b)
            this.buckets[b] = 0;

        // fill buckets
        for (let s = sampleStart; s < sampleEnd; ++s) {
            const bucketIndex = this._bucketIndex(s);
            this.buckets[bucketIndex] = Math.max(this.buckets[bucketIndex], Math.abs(this.samples.data[s]));
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

        // draw a simple cursor
        if (this.cursorPosition >= 0.0 && this.cursorPosition <= 1.0) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width * this.cursorPosition, -this.canvas.height / 2.0);
            this.ctx.lineTo(this.canvas.width * this.cursorPosition, this.canvas.height / 2.0);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }
}

module.exports = WaveformVisualizer;
