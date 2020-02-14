const EventEmitter = require('events');

class AudioPlayer extends EventEmitter {
    constructor(context, options) {
        super();

        this.channelCount = 1;
        this.channelCountMode = 'max';
        this.channelInterpretation = 'discrete';

        this._context = context;
        this._output = this.context.createGain();
        this._audioBuffer = options.audioBuffer || this.context.createBuffer(1, 0, this._audioContext.sampleRate);

        this._duration = this._audioBuffer.length / this._context.sampleRate;
        this._offset = 0;

        this._rampTime = 0.1;

        this._playbackStarted = 0;

        this._emitEnded = () => this.emit('ended');

        // sentinel objects to avoid additional state tracking
        this._ramp = new GainNode(this._context, {gain: 0.0});
        this._audioBufferSource = this._context.createBufferSource();
        this._audioBufferSource.start()
    }
    
    get context() {
        return this._context;
    }

    get numberOfInputs() {
        return 0;
    }

    get numberOfOutputs() {
        return 1;
    }

    connect() {
        this._output.connect.apply(this._output, arguments);
    }

    disconnect() {
        this._output.disconnect.apply(this._output, arguments);
    }

    get progress() {
        return this._offset;
    }

    setAudioBuffer(audioBuffer) {
        this.stop();
        this._audioBuffer = audioBuffer;
    }

    setFloat32Array(float32Array) {
        const audioBuffer = this._context.createBuffer(1, float32Array.length, this._context.sampleRate);
        audioBuffer.copyToChannel(float32Array, 0);
        this.setAudioBuffer(audioBuffer);
    }

    play() {
        this._playbackStarted = this._context.currentTime;
        this._pause();

        const remainingDuration = this._duration - this._offset;
        const ramp = new GainNode(this._context, {gain: 0});
        ramp.gain.linearRampToValueAtTime(1.0, this._context.currentTime + this._rampTime);
        ramp.gain.setValueAtTime(1.0, this._context.currentTime + remainingDuration - this._rampTime);
        ramp.gain.linearRampToValueAtTime(Number.EPSILON, this._context.currentTime + remainingDuration);
        ramp.connect(this._output);

        const audioBufferSource = this._context.createBufferSource();
        audioBufferSource.buffer = this._audioBuffer;
        audioBufferSource.connect(ramp);
        audioBufferSource.addEventListener('ended', () => {
            audioBufferSource.disconnect();
            ramp.disconnect();
        });
        audioBufferSource.addEventListener('ended', this._emitEnded);

        audioBufferSource.start(this._context.currentTime, this._offset);

        this._ramp = ramp;
        this._audioBufferSource = audioBufferSource;

        this.emit('playing', this._offset);
    }

    _pause() {
        this._offset += this._context.currentTime - this._playbackStarted;
        this._ramp.gain.cancelAndHoldAtTime(this._context.currentTime);
        this._ramp.gain.linearRampToValueAtTime(Number.EPSILON, this._context.currentTime + this._rampTime);
        this._ramp.gain.setValueAtTime(0.0, this._context.currentTime + this._rampTime);
        this._audioBufferSource.removeEventListener('ended', this._emitEnded);
        this._audioBufferSource.stop(this._context.currentTime + this._rampTime);
    }

    pause() {
        this._pause();
        this.emit('paused', this._offset);
    }

    _stop() {
        this._pause();
        this._offset = 0;
    }

    stop() {
        this._stop();
        this.emit('stopped');
    }
}

// Inject the new class into AudioContext prototype.
AudioContext.prototype.createAudioPlayerNode =
    OfflineAudioContext.prototype.createAudioPlayerNode = function (options) {
        return new AudioPlayer(this, options);
    };

module.exports = AudioPlayer;
