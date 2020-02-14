const CompositeAudioNode = require("./composite-audio-node.js");

function _createFilter(audioContext) {
    const filter = audioContext.createBiquadFilter();
    filter.Q.value = 8.30;
    filter.frequency.value = 355;
    filter.gain.value = 3.0;
    filter.type = 'bandpass';
    return filter;
}

function _createCompressor(audioContext) {
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.reduction.value = -20;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;
    return compressor;
}

class MicrophoneFilterNode extends CompositeAudioNode {
    constructor(context, options) {
        super(context, options);

        this._filter = _createFilter(this.context);
        this._compressor = _createCompressor(this.context);
        this._filter.connect(this._compressor);

        this._firstChainNode = this._filter;
        this._lastChainNode = this._compressor;

        this.bypass = typeof options.bypass === "undefined" ? false : options.bypass;
    }

    get bypass() {
        return this._bypass;
    }

    set bypass(doBypass) {
        if (doBypass) {
            // enable bypassing
            this._input.disconnect();
            this._lastChainNode.disconnect();
            this._input.connect(this._output);
            this._bypass = true;
        } else {
            // disable bypassing
            this._input.disconnect();
            this._input.connect(this._firstChainNode);
            this._lastChainNode.connect(this._output);
            this._bypass = false;
        }
    }
}

// Inject the new class into AudioContext prototype.
AudioContext.prototype.createMicrophoneFilterNode =
    OfflineAudioContext.prototype.createMicrophoneFilterNode = function (options) {
        return new MicrophoneFilterNode(this, options);
    };

module.exports = MicrophoneFilterNode;
