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

    _addNodesForRecording() {
        this._gain = new GainNode(this._audioContext, {gain: 0});
        const rampTime = 0.01;
        this._gain.gain.linearRampToValueAtTime(1.0, this._audioContext.currentTime + rampTime);
        this._gain.gain.linearRampToValueAtTime(1.0, this._audioContext.currentTime + this._duration / 1000.0 - rampTime);
        this._gain.gain.linearRampToValueAtTime(0.0, this._audioContext.currentTime + this._duration / 1000.0);

        this._processor = this._audioContext.createScriptProcessor(1024, 1, 1);
        this._processor.addEventListener('audioprocess', this._appendAudioData);

        this._source.connect(this._gain);
        this._gain.connect(this._processor);
        this._processor.connect(this._audioContext.destination);
    }

    _removeNodesForRecording() {
        this._source.disconnect(this._gain);
        this._gain.disconnect(this._processor);
        this._processor.disconnect(this._audioContext.destination);

        this._processor.removeEventListener('audioprocess', this._appendAudioData);
        this._gain = null;
        this._processor = null;
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

        // add dummy node to keep audio flowing
        // otherwise, newly added nodes might pick up unprocessed audio from previous recording
        this._dummyGain = new GainNode(this._audioContext, {gain: 0});
        this._source.connect(this._dummyGain);
        this._dummyGain.connect(this._audioContext.destination);

        this._appendAudioData = e => {
            if (this._state === Recorder.states.RECORDING)
                this._samples.push(e.inputBuffer.getChannelData(0));
        };

        this._playbackStartedAt = this._audioContext.currentTime;
        this._audioBufferSource = null;
        this._playbackEndedListener = this.stopPlayback.bind(this);

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

    get playbackProgress() {
        if (this.state === Recorder.states.PLAYING) {
            return Math.min((this._audioContext.currentTime - this._playbackStartedAt) / this.duration, 1.0);
        } else {
            return 0.0;
        }
    }

    startRecording() {
        this.stopPlayback();
        this.stopRecording();

        assert(this.state === Recorder.states.IDLE);

        this._addNodesForRecording();

        this._setState(Recorder.states.RECORDING);
        this.emit('recording-started');
    }

    stopRecording() {
        if (this.state === Recorder.states.RECORDING) {
            this._removeNodesForRecording();
            this._setState(Recorder.states.IDLE);
            this.emit("recording-stopped");
        }
    }

    startPlayback() {
        this.stopPlayback();
        this.stopRecording();

        assert(this.state === Recorder.states.IDLE);
        assert(this._audioBufferSource === null);

        const audioBufferSource = this._audioContext.createBufferSource();
        audioBufferSource.buffer = this._audioBuffer;
        audioBufferSource.connect(this._destination);
        audioBufferSource.addEventListener("ended", this._playbackEndedListener);

        this._audioBufferSource = audioBufferSource;

        audioBufferSource.start();
        this._playbackStartedAt = this._audioContext.currentTime;

        this._setState(Recorder.states.PLAYING);
        this.emit("playback-started");
    }

    stopPlayback() {
        if (this.state === Recorder.states.PLAYING) {
            if (this._audioBufferSource !== null) {
                this._audioBufferSource.stop();
                this._audioBufferSource.removeEventListener("ended", this._playbackEndedListener);
                this._audioBufferSource.disconnect();
                this._audioBufferSource = null;
            }
            this._setState(Recorder.states.IDLE);
            this.emit('playback-stopped');
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
    "PLAYING": 2,
};
Object.freeze(Recorder.states);

module.exports = Recorder;
