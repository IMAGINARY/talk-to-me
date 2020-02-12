const assert = require('assert');
const ndarray = require('ndarray');
const opsExt = require('../common/ndarray-ops-ext.js');
const cli = require('../common/cli.js');
const getI18Next = require('../common/i18n.js');
const langmap = require('langmap');
const IdleDetector = require('./idle-detector.js');
const AutoViewport = require('./auto-viewport.js');

const $ = require('jquery');

const wav2letter = require("../common/wav2letter/wav2letter.js");
const {toUpperCase} = require("../common/util/string-utils.js");
const ImageUtils = require('../common/util/image-utils.js');

const isPackaged = require('../common/is-packaged.js');
const loadAudioFile = require("./loadAudioFile.js");

const MicrophoneFilterNode = require("./microphone-filter-node.js");
const Recorder = require("./recorder.js");
const WaveformVisualizer = require("./waveform-visualizer.js");
const visualizeDecoding = require("./decoding-visualizer.js");
const TextTransformationVisualizer = require("./text-transformation-visualizer.js");
const NetworkVisualizer = require("./network-visualizer.js");

const SAMPLE_RATE = 16000;
const AUDIO_DURATION_SEC = 2.5;

const supportedLanguages = ['en', 'de'];
const modelLoadedPromise = Promise.all(supportedLanguages
    .map(lang => wav2letter.transcribe({waveform: new Float32Array(), lang: lang})))
    .then(() => console.log("Speech recognition models loaded."));
const w2lOutputLengthPromise = modelLoadedPromise
    .then(() => wav2letter.computeOutputLength(AUDIO_DURATION_SEC * SAMPLE_RATE));

async function init() {
    const argv = await cli.argv();
    const i18next = await getI18Next();
    await $.ready;

    const autoViewport = new AutoViewport(window, {
        width: 1920,
        height: 1080,
        enable: true,
    });

    const idleTimeoutMs = 5 * 60 * 1000;
    const idleDetector = new IdleDetector();
    idleDetector.setTimeout(reset, idleTimeoutMs);

    const audioContext = new AudioContext({sampleRate: SAMPLE_RATE});
    const micInputNode = await Recorder.getMicrophoneAudioSource(audioContext);
    const recorderInputNode = new MicrophoneFilterNode(audioContext, {bypass: true});
    micInputNode.connect(recorderInputNode);

    const recorder = new Recorder({
        audioContext: audioContext,
        source: recorderInputNode,
        destination: audioContext.destination,
        duration: AUDIO_DURATION_SEC * 1000,
    });
    const samples = recorder.samples;

    const $textTransformationViz = $("#text-transformation-viz");
    const $decodingViz = $("#decoding-viz");
    const $networkViz = $("#network-viz");
    const $spectrogramViz = $("#spectrogram-viz");
    const $waveformViz = $("#waveform-viz");

    const W2L_OUTPUT_LENGTH = await w2lOutputLengthPromise;
    const LETTER_CELL_SIZE = Number(getComputedStyle(document.documentElement)
        .getPropertyValue('--cell-size')
        .replace(/px$/, ""));
    const FONT_SIZE = Number(getComputedStyle(document.documentElement)
        .getPropertyValue('--viz-font-size')
        .replace(/px$/, ""));
    const $waveformCanvas = $('#waveform-canvas');
    $waveformCanvas.attr("width", LETTER_CELL_SIZE * W2L_OUTPUT_LENGTH);
    const waveformVisualizer = new WaveformVisualizer($waveformCanvas.get(0), samples);
    const $spectrogramCanvasContainer = $('#spectrogram-viz .canvas-container');
    const $decodingContainer = $('#decoding-viz .decoding-container');
    const $textTransformationContainer = $('#text-transformation-viz .text-transformation-container');
    const networkVisualizer = new NetworkVisualizer(
        document.querySelector('#network-viz .network-container'),
        {cellSize: LETTER_CELL_SIZE}
    );
    const textTransformationVisualizer = new TextTransformationVisualizer(
        document.querySelector('#text-transformation-viz .text-transformation-container'),
        {cellSize: LETTER_CELL_SIZE, fontSize: FONT_SIZE}
    );

    //setInterval(() => networkVisualizer.currentLayer = (networkVisualizer.currentLayer + 1) % networkVisualizer.layers.length, 1000);

    async function loadDemoAudio() {
        const audioBaseUrl = new URL(isPackaged() ? "../../../audio/" : "../../audio/", window.location.href);
        const audioUrl = new URL('helloiamai_16kHz_16bit_short.wav', audioBaseUrl);
        const demoAudioBuffer = await loadAudioFile(audioContext, audioUrl);
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

    class AnimationQueue {
        constructor() {
            this._queue = [];
            this._running = Promise.resolve();
        }

        push(item) {
            this._queue.push(item);
        }

        async play() {
            await this._running;
            this._running = this._play();
            await this._running;
        }

        async _play() {
            while (this._queue.length > 0) {
                const item = this._queue.shift();
                await item();
            }
        }

        async wait() {
            await this._running;
        }

        clear() {
            this._queue.length = 0;
        }
    }

    const aq = new AnimationQueue();

    samples.on('full', async data => {
        const languages = i18next.languages.filter(l => supportedLanguages.includes(l));
        assert(languages.length > 0, `No supported language in ${i18next.languages}. Must include one of ${supportedLanguages}.`);

        window.waveform = data;
        window.predictionExt = await wav2letter.predictExt({waveform: data, lang: languages[0]});
        window.predictionExt.letters = toUpperCase(window.predictionExt.letters);

        // briefly show the viz containers to allow certain layout calculations
        $textTransformationViz.hide();
        $decodingViz.show();
        $networkViz.show();
        $spectrogramViz.show();

        // Visualize spectrogram
        const spectrogramCanvas = ImageUtils.convert2DArrayToCanvas(window.predictionExt.layers[0], ImageUtils.alphamap, {
            clearBeforeDrawing: true,
            flipV: true,
            normalize: true,
        });
        $spectrogramCanvasContainer.empty();
        $spectrogramCanvasContainer.append(spectrogramCanvas);

        const numBest = 4;
        const decodedPredictionExt = decodePredictionExt(window.predictionExt);
        const decoderSvg = visualizeDecoding(
            decodedPredictionExt.indices,
            decodedPredictionExt.probabilities,
            decodedPredictionExt.alphabet,
            numBest,
            LETTER_CELL_SIZE,
            FONT_SIZE,
        );
        $decodingContainer.empty();
        $decodingContainer.append(decoderSvg);

        let timeSlot = 0;
        for (let t = decodedPredictionExt.indices.shape[0] - 1; t >= 0; --t) {
            const letterIndex = decodedPredictionExt.indices.get(t, 0);
            const letter = decodedPredictionExt.alphabet[letterIndex];
            if (letter.match(/[a-z]/) !== null)
                timeSlot = t;
        }

        networkVisualizer.setLayers(predictionExt.layers, window.predictionExt.letters);
        textTransformationVisualizer.setRaw(decodedPredictionExt.indices, decodedPredictionExt.alphabet);

        // hide the viz containers before starting animations
        $textTransformationViz.hide();
        $decodingViz.hide();
        $networkViz.hide();
        $spectrogramViz.hide();

        if (argv.disableAnimations) {
            $spectrogramViz.show();
            $networkViz.show();
            networkVisualizer.goToLast(false);
            $decodingViz.show();
            $textTransformationViz.show();
            textTransformationVisualizer.goToLast(false);
        } else {
            const animDurationMs = 500;
            const delayMs = 2000;
            const delayAnim = () => new Promise(resolve => setTimeout(resolve, delayMs));
            const slideDown = $elems => () => new Promise(resolve => $elems.slideDown(animDurationMs, resolve))

            aq.push(slideDown($spectrogramViz));
            aq.push(delayAnim);
            aq.push(slideDown($networkViz));
            aq.push(async () => await networkVisualizer.autoplay());
            aq.push(delayAnim);
            aq.push(slideDown($decodingViz));
            aq.push(delayAnim);
            aq.push(slideDown($textTransformationViz));
            aq.push(async () => await textTransformationVisualizer.autoplay());
            aq.play();
        }

        // TODO: wrap into module
        setCursorPosition(timeSlot, decodedPredictionExt.indices.shape[0]);
        $("#cursor").show();
    });

    function reset() {
        recorder.stopRecording();
        recorder.stopPlayback();

        aq.clear();

        samples.clear();
        $spectrogramCanvasContainer.empty();
        networkVisualizer.clear();
        $decodingContainer.empty();
        textTransformationVisualizer.clear();

        $textTransformationViz.hide();
        $decodingViz.hide();
        $networkViz.hide();
        $spectrogramViz.hide();

        untoggleButton(recordButton);
        untoggleButton(playButton);

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

    function untoggleButton($button) {
        if ($button.hasClass('active'))
            $button.button('toggle');
    }

    playButton.hide();

    samples.on('full', () => {
        recordButton.hide();
        playButton.show();
    });
    samples.on('empty', () => {
        untoggleButton(recordButton);
        untoggleButton(playButton);
        playButton.hide();
        recordButton.show();
    });
    recorder.on('recording-stopped', () => recordButton.button('toggle'));
    recorder.on('playback-stopped', () => playButton.button('toggle'));

    recordButton.on('click', () => recorder.startRecording());
    playButton.on('click', () => recorder.startPlayback());
    restartButton.on('click', reset);

    function addSupportedLanguages() {
        for (let l of supportedLanguages) {
            const nativeName = langmap[l]["nativeName"];
            const $div = $("<a></a>")
                .attr("data-lang", l)
                .attr("href", "#")
                .addClass("dropdown-item")
                .text(nativeName);
            $("#language-selector").append($div);
        }
    }

    async function setLanguage(lang) {
        await i18next.changeLanguage(lang);
        const t = i18next.getFixedT(null, 'frontend');
        const elemsToLocalize = [
            {querySelector: "#text-transformation-viz .explanation", key: "short-expl.textTransformation"},
            {querySelector: "#decoding-viz .explanation", key: "short-expl.decoder"},
            {querySelector: "#network-viz .explanation", key: "short-expl.network"},
            {querySelector: "#spectrogram-viz .explanation", key: "short-expl.spectrogram"},
            {querySelector: "#waveform-viz .explanation", key: "short-expl.waveform"},
        ];
        elemsToLocalize.forEach(elem => $(elem.querySelector).html(t(elem.key)));
        reset();
    }

    addSupportedLanguages();
    $("#language-selector > a").on('click', e => {
        const newLanguage = e.currentTarget.getAttribute("data-lang");
        if (newLanguage !== i18next.language)
            setLanguage(newLanguage);
    });
    setLanguage(i18next.language);

    reset();
    if (argv.demo)
        await loadDemoAudio();
}

module.exports = {init: init};
