const MIN_AMPLITUDE = 0.1;

class WaveformVisualizer {
    constructor(canvas, samples, liveSamplesCb) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.samples = samples;
        this.samples.on('empty', () => this._clear());
        this.samples.on('data_changed', (data, start, end) => this._receiveSamples(start, end));
        this.buckets = new Float32Array(this.canvas.width);

        this._liveSamplesCb = liveSamplesCb;

        this._cursorPosition = 0.0;

        this._requestAnimationFrameCB = this._redraw.bind(this);
        this._requestAnimationFrameCBId = 0;

        const callback = (mutationsList, observer) => {
            const attributes = ['width', 'height'];
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes' && attributes.indexOf(mutation.attributeName) !== -1) {
                    this._redraw();
                    break;
                }
            }
        };
        this._observer = new MutationObserver(callback);
        this._observer.observe(this.canvas, {attributes: true});

        this.liveMode = true;
    }

    get cursorPosition() {
        return this._cursorPosition;
    }

    set cursorPosition(pos) {
        this._cursorPosition = pos;
        this.requestRedraw();
    }

    get liveMode() {
        return this._liveMode;
    }

    set liveMode(enabled) {
        this._liveMode = enabled;
        if (enabled)
            this.requestRedraw()
    }

    requestRedraw() {
        cancelAnimationFrame(this._requestAnimationFrameCBId);
        this._requestAnimationFrameCBId = requestAnimationFrame(this._requestAnimationFrameCB);
    }

    _clear() {
        this.buckets.fill(0.0);
        this.requestRedraw();
    }

    _bucketIndex(sampleIndex) {
        return Math.floor((sampleIndex / this.samples.maxLength) * this.buckets.length);
    }

    _receiveSamples(sampleStart, sampleEnd) {
        const bucketStart = this._bucketIndex(sampleStart);
        const bucketEnd = this._bucketIndex(sampleEnd) + 1;

        // clear buckets that will be refilled
        for (let b = bucketStart; b < bucketEnd; ++b)
            this.buckets[b] = 0;

        // fill buckets
        for (let s = sampleStart; s < sampleEnd; ++s) {
            const bucketIndex = this._bucketIndex(s);
            this.buckets[bucketIndex] = Math.max(this.buckets[bucketIndex], Math.abs(this.samples.data[s]));
        }
        this.requestRedraw();
    }


    _redraw() {
        if (this.buckets.length != this.canvas.width) {
            this.buckets = new Float32Array(this.canvas.width);
            this._receiveSamples(0, this.samples.length);
        }

        const liveSamples = this.liveMode ? this._liveSamplesCb() : new Float32Array(0);

        // compute maximum amplitude
        const computeMaxAmplitude = (buf, min) => buf.reduce((max, cur) => Math.max(max, Math.abs(cur)), min);
        const maxBucketAmplitude = computeMaxAmplitude(this.buckets, MIN_AMPLITUDE);
        const maxLiveAmplitude = this.liveMode ? computeMaxAmplitude(liveSamples, MIN_AMPLITUDE) : MIN_AMPLITUDE;
        const maxAmplitude = Math.max(maxBucketAmplitude, maxLiveAmplitude);

        const boundedCursorPosition = Math.max(0.0, this.cursorPosition);
        const color = window.getComputedStyle(this.canvas).color;

        const ctx = this.ctx;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();

        ctx.imageSmoothingEnabled = false;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;

        ctx.save();
        ctx.translate(0.0, 0.5 * this.canvas.height);
        ctx.scale(this.canvas.width / this.buckets.length, 0.5 * this.canvas.height / maxAmplitude);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo((this.liveMode ? boundedCursorPosition : 1.0) * this.buckets.length, 0);
        for (let i = 0; i < this.buckets.length; ++i)
            ctx.fillRect(i, -this.buckets[i], 1, 2.0 * this.buckets[i]);
        ctx.restore();
        ctx.stroke();

        ctx.lineWidth = 3;
        if (this.liveMode && this.cursorPosition < 1.0) {

            ctx.save();

            ctx.translate(boundedCursorPosition * this.canvas.width, 0.5 * this.canvas.height);
            ctx.scale(this.canvas.width / liveSamples.length, 0.5 * this.canvas.height / maxAmplitude);

            ctx.beginPath();
            ctx.moveTo(0, 0);
            liveSamples.forEach((v, i) => ctx.lineTo(i, v));
            ctx.lineTo(liveSamples, 0.0);

            ctx.restore();
            ctx.stroke();

            this.requestRedraw();
        }

        // draw a simple cursor
        if (this.cursorPosition >= 0.0 && this.cursorPosition <= 1.0) {
            const cursorColor = window.getComputedStyle(document.documentElement)
                .getPropertyValue('--viz-snd-color');
            ctx.fillStyle = cursorColor;
            ctx.fillRect(this.cursorPosition * this.canvas.width, 0, 3, this.canvas.height);
        }

        ctx.restore();
    }
}

module.exports = WaveformVisualizer;
