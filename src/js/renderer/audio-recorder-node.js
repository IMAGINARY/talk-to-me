const assert = require('assert');
const EventEmitter = require('events');
const FixedSizeBuffer = require("../common/util/FixedSizeBuffer.js");

class AudioRecorderNode extends EventEmitter {
    _setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this._state = newState;
            this.emit('state-changed', newState, oldState);
        }
    }

    get _isAudioRecorderNode() {
        return true;
    }

    constructor(context, options) {
        super();

        this.channelCount = 1;
        this.channelCountMode = 'max';
        this.channelInterpretation = 'discrete';

        this._context = context;

        this._duration = options.duration;
        const numSamples = (this._context.sampleRate * this._duration) / 1000;
        this._audioBuffer = this._context.createBuffer(1, numSamples, this._context.sampleRate);
        this._samples = FixedSizeBuffer.wrapArray(this._audioBuffer.getChannelData(0));

        // automatically stop recording whenever the buffer is filled
        this._samples.on('full', this.stopRecording.bind(this));

        // properly restart recording if buffer is emptied while recording
        this._samples.on('empty', () => {
            if (this.state === AudioRecorderNode.states.RECORDING) {
                this.startRecording();
            }
        });

        this._input = this._context.createGain();

        this._appendAudioData = e => {
            if (this._state === AudioRecorderNode.states.RECORDING)
                this._samples.push(e.inputBuffer.getChannelData(0));
        };
        this._processor = this._context.createScriptProcessor(1024, 1, 1);
        this._processor.addEventListener('audioprocess', this._appendAudioData);

        this._input.connect(this._processor);
        this._processor.connect(this._context.destination);

        this._state = AudioRecorderNode.states.IDLE;
    }

    get numberOfInputs() {
        return 1;
    }

    get numberOfOutputs() {
        return 0;
    }

    get state() {
        return this._state;
    }

    get samples() {
        return this._samples;
    }

    get duration() {
        return this._duration;
    }

    get audioBuffer() {
        return this._audioBuffer;
    }

    get recordingProgress() {
        return this._samples.maxLength / this._samples.length;
    }

    startRecording() {
        this.stopRecording();

        assert(this.state === AudioRecorderNode.states.IDLE);

        this._setState(AudioRecorderNode.states.RECORDING);
        this.emit('recording-started');
    }

    recordFromBuffer(audioBuffer) {
        this.stopRecording();
        this.startRecording();

        this._samples.push(audioBuffer.getChannelData(0));

        this.stopRecording();
    }

    stopRecording() {
        if (this.state === AudioRecorderNode.states.RECORDING) {
            this._setState(AudioRecorderNode.states.IDLE);
            this.emit("recording-stopped");
        }
    }

    static async getMicrophoneAudioSource(audioContext, options) {
        const defaultOptions = {
            sampleRate: audioContext.sampleRate,
            noiseSuppression: true,
            autoGainControl: false,
        };
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: Object.assign(defaultOptions, options),
            video: false
        });

        return audioContext.createMediaStreamSource(micStream);
    }

    connect() {
        this._output.connect.apply(this._output, arguments);
    }

    disconnect() {
        this._output.disconnect.apply(this._output, arguments);
    }
}

AudioRecorderNode.states = {
    "IDLE": 0,
    "RECORDING": 1,
};
Object.freeze(AudioRecorderNode.states);


AudioNode.prototype._connect_beforeAudioRecorderNode = AudioNode.prototype.connect;
AudioNode.prototype.connect = function () {
    const args = Array.prototype.slice.call(arguments);
    if (args[0]._isAudioRecorderNode)
        args[0] = args[0]._input;

    this._connect_beforeAudioRecorderNode.apply(this, args);
};

// Inject the new class into AudioContext prototype.
AudioContext.prototype.createAudioRecorderNode =
    OfflineAudioContext.prototype.createAudioRecorderNode = function (options) {
        return new AudioRecorderNode(this, options);
    };

module.exports = AudioRecorderNode;
