const EventEmitter = require('events');

class AudioPlayer extends EventEmitter {
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

    setAudioBuffer(audioBuffer) {
        this.stop();
        this._audioBuffer = audioBuffer;
    }

    setFloat32Array(float32Array) {
        const audioBuffer = this._audioContext.createBuffer(1, float32Array.length, this._audioContext.sampleRate);
        audioBuffer.copyToChannel(float32Array, 0);
        this.setAudioBuffer(audioBuffer);
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

    _stop() {
        this._pause();
        this._offset = 0;
    }

    stop() {
        this._stop();
        this.emit('stopped');
    }
}

module.exports = AudioPlayer;
