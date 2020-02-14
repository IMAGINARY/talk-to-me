require('./extend-audio-node-for-private-input.js');

// based on https://github.com/GoogleChromeLabs/web-audio-samples/wiki/CompositeAudioNode
class CompositeAudioNode {
    get _hasPrivateInputNode() {
        return true;
    }

    constructor(context, options) {
        this.context = context;
        this._input = this.context.createGain();
        this._output = this.context.createGain();
    }

    connect() {
        this._output.connect.apply(this._output, arguments);
    }

    disconnect() {
        this._output.disconnect.apply(this._output, arguments);
    }
}

module.exports = CompositeAudioNode;
