const assert = require('assert');
const EventEmitter = require('events');
require('./extend-audio-node-for-private-input.js');
const FixedSizeBuffer = require("../../common/util/fixed-size-buffer.js");

class AudioRecorderNode extends EventEmitter {
    _setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this._state = newState;
            this.emit('state-changed', newState, oldState);
        }
    }

    get _hasPrivateInputNode() {
        return true;
    }

    constructor(context, options) {
        super();

        this.channelCount = 1;
        this.channelCountMode = 'max';
        this.channelInterpretation = 'discrete';

        this._context = context;

        const defaultOptions = {
            duration: 2000,
            preRecordingDuration: 0,
        };
        options = Object.assign(defaultOptions, options);

        this._duration = options.duration;
        this._preRecordingDuration = options.preRecordingDuration;
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

        this._appendAudioDataCallback = this._consumeAudioData.bind(this);
        this._processor = this._context.createScriptProcessor(1024, 1, 1);
        this._processor.addEventListener('audioprocess', this._appendAudioDataCallback);

        this._input.connect(this._processor);
        this._processor.connect(this._context.destination);

        this._state = AudioRecorderNode.states.IDLE;
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

    startPreRecording() {
        this.stopPreRecording();
        this.stopRecording();

        assert(this.state === AudioRecorderNode.states.IDLE);

        this._setState(AudioRecorderNode.states.PRERECORDING);
        this.emit('pre-recording-started');
    }

    stopPreRecording() {
        if (this.state === AudioRecorderNode.states.PRERECORDING) {
            this._setState(AudioRecorderNode.states.IDLE);
            this.emit("pre-recording-stopped");
        }
    }

    startRecording() {
        this.stopPreRecording();
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

    _consumeAudioData(ape) {
        const newData = ape.inputBuffer.getChannelData(0);
        if (this._state === AudioRecorderNode.states.RECORDING) {
            this._samples.push(ape.inputBuffer.getChannelData(0));
        } else if (this._state === AudioRecorderNode.states.PRERECORDING) {
            const numPreRecordingSamples = Math.floor(this._preRecordingDuration * this._context.sampleRate / 1000.0);
            if (this._samples.length <= numPreRecordingSamples) {
                // create a sub-array that fits into the pre-recording area
                const newPreData = newData.subarray(Math.max(0, newData.length - numPreRecordingSamples));

                // move the already pre-recorded samples towards the beginning of the array
                // to make room for the new data
                const newLength = Math.min(this._samples.length + newPreData.length, numPreRecordingSamples);
                const viewIntoOldData = this.samples.data;
                const viewForNewData = this.samples.buffer.subarray(0, newLength);
                const lengthToMove = newLength - newPreData.length;
                viewIntoOldData.copyWithin(0, viewIntoOldData.length - lengthToMove, viewIntoOldData.length);

                // copy the new data into the new created free space
                viewForNewData.set(newPreData, lengthToMove);

                // set the new length
                this._samples.length = newLength;
                this._samples.postData(0, newLength);
            }
        }
    };

    static async getMicrophoneAudioSource(audioContext, options) {
        const defaultOptions = {
            latency: 0.05,
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
    "PRERECORDING": 2,
};
Object.freeze(AudioRecorderNode.states);

// Inject the new class into AudioContext prototype.
AudioContext.prototype.createAudioRecorderNode =
    OfflineAudioContext.prototype.createAudioRecorderNode = function (options) {
        return new AudioRecorderNode(this, options);
    };

module.exports = AudioRecorderNode;
