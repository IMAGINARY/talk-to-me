const EventEmitter = require('events');
require('./extend-audio-node-for-private-input.js');

// Roughly based on the MIT licensed hark.js
// https://raw.githubusercontent.com/otalk/hark/master/hark.js
class BarkDetectorNode extends EventEmitter {

    static TOTAL_SILENCE = -100.0;

    get _hasPrivateInputNode() {
        return true;
    }

    constructor(context, options) {
        super();

        const defaultOptions = {
            smoothingTimeConstant: 0.1,
            history: 10,
            interval: 50,
            threshold: -50,
        };

        options = Object.assign(defaultOptions, options);

        this._context = context;
        this.channelCount = 1;

        this._input = this._analyzer = this._context.createAnalyser({
            fftSize: 512,
            smoothingTimeConstant: options.smoothingTimeConstant,
        });
        this._fftBins = new Float32Array(this._analyzer.frequencyBinCount);

        this._signalHistory = new Array(options.history).fill(0);
        this._barking = false;

        this.interval = options.interval;
        this.threshold = options.threshold;

        loop(this._pollAnalyzer.bind(this), () => this.interval);
    }

    get context() {
        return this._context;
    }

    get numberOfInputs() {
        return 1;
    }

    get numberOfOutputs() {
        return 0;
    }

    connect() {
    }

    disconnect() {
    }

    get isOn() {
        return this._barking;
    }

    get smoothingTimeConstant() {
        return this._analyzer.smoothingTimeConstant;
    }

    set smoothingTimeConstant(value) {
        this._analyzer.smoothingTimeConstant = value;
    }

    get history() {
        return this._signalHistory.length;
    }

    set history(length) {
        while (this._signalHistory.length < length)
            this._signalHistory.unshift(0);
        while (this._signalHistory.length > length)
            this._signalHistory.shift();
    }

    _getMaxVolume() {
        this._analyzer.getFloatFrequencyData(this._fftBins);
        return this._fftBins.reduce(
            (max, cur) => max = cur > max && cur < 0 ? cur : max,
            BarkDetectorNode.TOTAL_SILENCE,
        );
    }

    _pollAnalyzer() {
        const currentVolume = this._getMaxVolume();
        this.emit('volume_change', currentVolume, this.threshold);

        if (currentVolume > this.threshold && !this.isOn) {
            // trigger quickly, short history
            const historySum = sum(this._signalHistory, this._signalHistory.length - 3);
            if (historySum >= 2) {
                this._barking = true;
                this.emit('on');
            }
        } else if (currentVolume < this.threshold && this.isOn) {
            const historySum = sum(this._signalHistory);
            if (historySum === 0) {
                this._barking = false;
                this.emit('off');
            }
        }
        this._signalHistory.shift();
        this._signalHistory.push(0 + (currentVolume > this.threshold));
    };
}

// Inject the new class into AudioContext prototype.
AudioContext.prototype.createBarkAnalyzerNode =
    OfflineAudioContext.prototype.createBarkAnalyzerNode = function (options) {
        return new BarkDetectorNode(this, options);
    };

module.exports = BarkDetectorNode;

function sum(summands, start, end) {
    start = typeof start === "undefined" ? 0 : Math.max(0, start);
    end = typeof end === "undefined" ? summands.length : Math.min(start, summands.length);
    let s = 0;
    for (let i = start; i < end; ++i)
        s += summands[i];
    return s;
}

function loop(callback, intervalGetter) {
    const loopFunc = () => setTimeout(() => loopFunc() && callback(), intervalGetter());
    loopFunc();
}
