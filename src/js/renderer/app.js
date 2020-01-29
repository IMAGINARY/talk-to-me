const ndarray = require('ndarray');
const opsExt = require('../common/ndarray-ops-ext.js');

const $ = require('jquery');

const wav2letter = require("../common/wav2letter/wav2letter.js");
const {toUpperCase} = require("../common/util/string-utils.js");
const ImageUtils = require('../common/util/image-utils.js');

const loadAudioFile = require("./loadAudioFile.js");

const MicrophoneFilterNode = require("./microphone-filter-node.js");
const Recorder = require("./recorder.js");
const WaveformVisualizer = require("./waveform-visualizer.js");
const TranscriptionVisualizer = require("./transcription-visualizer.js");
const NetworkVisualizer = require("./network-visualizer.js");

Promise.all(['en', 'de'].map(lang => wav2letter.transcribe({waveform: new Float32Array(), lang: lang})))
    .then(() => console.log("Speech recognition models loaded."));

async function init() {
    await $.ready;

    const audioContext = new AudioContext({sampleRate: 16000});
    const micInputNode = await Recorder.getMicrophoneAudioSource(audioContext);
    const recorderInputNode = new MicrophoneFilterNode(audioContext, {bypass: true});
    micInputNode.connect(recorderInputNode);

    const recorder = new Recorder({
        audioContext: audioContext,
        source: recorderInputNode,
        destination: audioContext.destination,
        duration: 2 * 1000 /* 2s */,
    });
    const samples = recorder.samples;

    const waveformVisualizer = new WaveformVisualizer(document.querySelector('#waveform-canvas'), samples);
    const spectrogramCanvas = document.querySelector('#spectrogram-canvas');
    const transcriptionVisualizer = new TranscriptionVisualizer(document.querySelector('#decoding-canvas'));
    const networkVisualizer = new NetworkVisualizer(document.querySelector('#network-canvas'));

    //setInterval(() => networkVisualizer.currentLayer = (networkVisualizer.currentLayer + 1) % networkVisualizer.layers.length, 1000);

    async function loadDemoAudio() {
        const demoAudioBuffer = await loadAudioFile(audioContext, new URL('../../audio/helloiamai_16kHz_16bit_short.wav', window.location.href));
        recorder.recordFromBuffer(demoAudioBuffer);
    }

    function decodePredictionExt(predictionExt) {
        const letterActivations = predictionExt.layers[predictionExt.layers.length - 1];
        const decoded = wav2letter.decoder.decodeGreedyAll(letterActivations);
        return {
            indices: decoded,
            probabilities: letterActivations,
            alphabet: predictionExt.letters,
        };
    }

    samples.on('full', async data => {
        window.waveform = data;
        window.predictionExt = await wav2letter.predictExt({waveform: data, lang: language});
        window.predictionExt.letters = toUpperCase(window.predictionExt.letters);
        ImageUtils.draw2DArrayToCanvas(window.predictionExt.layers[0], ImageUtils.alphamap, spectrogramCanvas, {
            clearBeforeDrawing: true,
            flipV: true,
            normalize: true,
        });
        const decodedPredictionExt = decodePredictionExt(window.predictionExt);
        transcriptionVisualizer.draw(
            decodedPredictionExt.indices,
            decodedPredictionExt.probabilities,
            decodedPredictionExt.alphabet,
            4
        );
        let timeSlot = 0;
        for (let t = decodedPredictionExt.indices.shape[0] - 1; t >= 0; --t) {
            const letterIndex = decodedPredictionExt.indices.get(t, 0);
            const letter = decodedPredictionExt.alphabet[letterIndex];
            if (letter.match(/[a-z]/) !== null)
                timeSlot = t;
        }

        networkVisualizer.layers = predictionExt.layers;
        networkVisualizer.currentLayer = predictionExt.layers.length - 1;

        // TODO: wrap into module
        setCursorPosition(timeSlot, decodedPredictionExt.indices.shape[0]);
        $("#cursor").show();
    });

    function reset() {
        samples.clear();
        ImageUtils.clearCanvas(spectrogramCanvas);
        transcriptionVisualizer.clear();
        networkVisualizer.clear();

        // TODO: wrap into module
        $("#cursor").hide();
    }

    function setCursorPosition(letterIndex, numLetters) {
        const cursorWidth = 16;
        const rect = $("#waveform-viz").get(0).getBoundingClientRect();
        const discreteLeft = ((letterIndex + 0.5) / numLetters) * rect.width - cursorWidth / 2.0;
        $("#cursor").css('left', `${discreteLeft}px`);
    }

    const moveCb = evt => {
        const numLetters = 100; // TODO: Don't hard-code!

        const rect = $vizContainer.get(0).getBoundingClientRect();
        const left = Math.max(0, Math.min(evt.clientX - rect.left, rect.width));
        const lerp = left / rect.width;
        const letterIndex = Math.floor(lerp * numLetters);

        setCursorPosition(letterIndex, numLetters);
        //networkVisualizer.draw(letterIndex);
    };
    const $vizContainer = $('#viz-container');
    $vizContainer.on('pointerdown', evt => {
        moveCb(evt);
        $vizContainer.on('pointermove', evt => moveCb(evt));
    }).on('pointerup', function () {
        $vizContainer.unbind('pointermove');
    });

    const recordButton = $("#record-button");
    const playButton = $("#play-button");
    const restartButton = $("#restart-button");

    playButton.hide();

    samples.on('full', () => {
        recordButton.hide();
        playButton.show();
    });
    samples.on('empty', () => {
        playButton.hide();
        recordButton.show();
    });
    recorder.on('recording-stopped', () => recordButton.button('toggle'));
    recorder.on('playback-stopped', () => playButton.button('toggle'));

    recordButton.on('click', () => recorder.startRecording());
    playButton.on('click', () => recorder.startPlayback());
    restartButton.on('click', reset);

    let language = "en";
    $("#language-selector > a").on('click', e => {
        language = e.currentTarget.getAttribute("data-lang");
        reset();
    });

    reset();
    await loadDemoAudio();
}

module.exports = {init: init};
