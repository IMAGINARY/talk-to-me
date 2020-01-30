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

        this._player = new Player(this._destination, this.audioBuffer);
        this._player.on('ended', this.stopPlayback.bind(this));

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
            return Math.min((this._player.progress * 1000.0) / this.duration, 1.0);
        } else {
            return 0.0;
        }
    }

    startRecording() {
        this.stopPlayback();
        this.stopRecording();

        assert(this.state === Recorder.states.IDLE);

        this._setState(Recorder.states.RECORDING);
        this.emit('recording-started');
    }

    recordFromBuffer(audioBuffer) {
        this.stopPlayback();
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

    startPlayback() {
        this.stopPlayback();
        this.stopRecording();

        assert(this.state === Recorder.states.IDLE);

        this._player.play();

        this._setState(Recorder.states.PLAYING);
        this.emit("playback-started");
    }

    stopPlayback() {
        if (this.state === Recorder.states.PLAYING) {
            this._player.stop();

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


class Player extends EventEmitter {
    constructor(destination, audioBuffer) {
        super();

        this._destination = destination;
        this._audioContext = destination.context;
        this._audioBuffer = audioBuffer;

        this._duration = this._audioBuffer.length / this._audioContext.sampleRate;
        this._offset = 0;

        this._rampTime = 0.1;

        this._playbackStarted = 0;

        this._emitEnded = () => this.emit('ended');

        // sentinel objects to avoid additional state tracking
        this._ramp = new GainNode(this._audioContext, {gain: 0.0});
        this._audioBufferSource = this._audioContext.createBufferSource();
        this._audioBufferSource.start()
    }

    get progress() {
        return this._offset;
    }

    play() {
        this._playbackStarted = this._audioContext.currentTime;
        this._pause();

        const remainingDuration = this._duration - this._offset;
        const ramp = new GainNode(this._audioContext, {gain: 0});
        ramp.gain.linearRampToValueAtTime(1.0, this._audioContext.currentTime + this._rampTime);
        ramp.gain.setValueAtTime(1.0, this._audioContext.currentTime + remainingDuration - this._rampTime);
        ramp.gain.linearRampToValueAtTime(Number.EPSILON, this._audioContext.currentTime + remainingDuration);
        ramp.connect(this._destination);

        const audioBufferSource = this._audioContext.createBufferSource();
        audioBufferSource.buffer = this._audioBuffer;
        audioBufferSource.connect(ramp);
        audioBufferSource.addEventListener('ended', () => {
            audioBufferSource.disconnect();
            ramp.disconnect();
        });
        audioBufferSource.addEventListener('ended', this._emitEnded);

        audioBufferSource.start(this._audioContext.currentTime, this._offset);

        this._ramp = ramp;
        this._audioBufferSource = audioBufferSource;

        this.emit('playing', this._offset);
    }

    _pause() {
        this._offset += this._audioContext.currentTime - this._playbackStarted;
        this._ramp.gain.cancelAndHoldAtTime(this._audioContext.currentTime);
        this._ramp.gain.linearRampToValueAtTime(Number.EPSILON, this._audioContext.currentTime + this._rampTime);
        this._ramp.gain.setValueAtTime(0.0, this._audioContext.currentTime + this._rampTime);
        this._audioBufferSource.removeEventListener('ended', this._emitEnded);
        this._audioBufferSource.stop(this._audioContext.currentTime + this._rampTime);
    }

    pause() {
        this._pause();
        this.emit('paused', this._offset);
    }

    stop() {
        this.pause();
        this._offset = 0;
    }
}

module.exports = Recorder;
