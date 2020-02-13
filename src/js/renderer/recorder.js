const assert = require('assert');
const EventEmitter = require('events');
const FixedSizeBuffer = require("../common/util/FixedSizeBuffer.js");

class Recorder extends EventEmitter {
    _setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this._state = newState;
            this.emit('state-changed', newState, oldState);
        }
    }

    constructor(options) {
        super();
        this._audioContext = options.audioContext;

        this._duration = options.duration;
        const numSamples = (this._audioContext.sampleRate * this._duration) / 1000;
        this._audioBuffer = this._audioContext.createBuffer(1, numSamples, this._audioContext.sampleRate);
        this._samples = FixedSizeBuffer.wrapArray(this._audioBuffer.getChannelData(0));

        // automatically stop recording whenever the buffer is filled
        this._samples.on('full', this.stopRecording.bind(this));

        // properly restart recording if buffer is emptied while recording
        this._samples.on('empty', () => {
            if (this.state === Recorder.states.RECORDING) {
                this.startRecording();
            }
        });

        this._source = options.source;
        this._destination = options.destination;

        this._appendAudioData = e => {
            if (this._state === Recorder.states.RECORDING)
                this._samples.push(e.inputBuffer.getChannelData(0));
        };
        this._processor = this._audioContext.createScriptProcessor(1024, 1, 1);
        this._processor.addEventListener('audioprocess', this._appendAudioData);

        this._source.connect(this._processor);
        this._processor.connect(this._audioContext.destination);

        this._state = Recorder.states.IDLE;
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

        assert(this.state === Recorder.states.IDLE);

        this._setState(Recorder.states.RECORDING);
        this.emit('recording-started');
    }

    recordFromBuffer(audioBuffer) {
        this.stopRecording();
        this.startRecording();

        this._samples.push(audioBuffer.getChannelData(0));

        this.stopRecording();
    }

    stopRecording() {
        if (this.state === Recorder.states.RECORDING) {
            this._setState(Recorder.states.IDLE);
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
}

Recorder.states = {
    "IDLE": 0,
    "RECORDING": 1,
};
Object.freeze(Recorder.states);

module.exports = Recorder;
