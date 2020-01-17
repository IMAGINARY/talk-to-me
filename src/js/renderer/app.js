const ndarray = require('ndarray');
const opsExt = require('../common/ndarray-ops-ext.js');

const $ = require('jquery');

const wav2letter = require("../common/wav2letter/wav2letter.js");

const MicrophoneFilterNode = require("./microphone-filter-node.js");
const Recorder = require("./recorder.js");
const WaveformVisualizer = require("./waveform-visualizer.js");
const SpectrogramVisualizer = require("./spectrogram-visualizer.js");
const TranscriptionVisualizer = require("./transcription-visualizer.js");

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

    const waveformVisualizer = new WaveformVisualizer(document.querySelector('#waveform-viz'), samples);
    const spectrogramVisualizer = new SpectrogramVisualizer(document.querySelector('#spectrogram-viz'));
    const transcriptionVisualizer = new TranscriptionVisualizer(document.querySelector('#transcription-viz'));

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
        spectrogramVisualizer.draw(window.predictionExt.logMelSpectrogram);
        const decodedPredictionExt = decodePredictionExt(window.predictionExt);
        transcriptionVisualizer.draw(
            decodedPredictionExt.indices,
            decodedPredictionExt.probabilities,
            decodedPredictionExt.alphabet,
            4
        );
    });

    function reset() {
        samples.clear();
        spectrogramVisualizer.clear();
        transcriptionVisualizer.clear();
    }

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
}

module.exports = {init: init};
