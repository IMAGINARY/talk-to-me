const assert = require('assert');
const ndarray = require('ndarray');
const opsExt = require('../common/ndarray-ops-ext.js');
const cli = require('../common/cli.js');
const getI18Next = require('../common/i18n.js');
const langmap = require('langmap');
const Color = require('color');
const IdleDetector = require('./idle-detector.js');
const AutoViewport = require('./auto-viewport.js');

const $ = require('jquery');
const Hammer = require('hammerjs');

const wav2letter = require("../common/wav2letter/wav2letter.js");
const {toUpperCase} = require("../common/util/string-utils.js");
const ImageUtils = require('../common/util/image-utils.js');

const isPackaged = require('../common/is-packaged.js');
const loadAudioFile = require("./webaudio/load-audio-file.js");

const MicrophoneFilterNode = require("./webaudio/microphone-filter-node.js");
const AudioRecorderNode = require("./webaudio/audio-recorder-node.js");
const AudioPlayerNode = require("./webaudio/audio-player-node.js");
const BarkDetectorNode = require('./webaudio/bark-detector-node.js');
const WaveformVisualizer = require("./waveform-visualizer.js");
const visualizeDecoding = require("./decoding-visualizer.js");
const TextTransformationVisualizer = require("./text-transformation-visualizer.js");
const NetworkVisualizer = require("./network-visualizer.js");

const SAMPLE_RATE = 16000;
const AUDIO_DURATION_SEC = 2.5;
const AnimationQueue = require('./animation-queue.js');

const supportedLanguages = ['en', 'de'];
const modelLoadedPromise = Promise.all(supportedLanguages
    .map(lang => wav2letter.transcribe({waveform: new Float32Array(), lang: lang})))
    .then(() => console.log("Speech recognition models loaded."));
const w2lOutputLengthPromise = modelLoadedPromise
    .then(() => wav2letter.computeOutputLength(AUDIO_DURATION_SEC * SAMPLE_RATE));

// define the duration for certain animations
const animationDurations = {
    slideDown: 500,
    slideDelay: 2000,
    networkTransition: 300,
    networkDelay: 200,
    textTransform: 1000,
};
const turboFactor = 0.025;
const turboAnimationDurations = Object.fromEntries(
    Object.entries(animationDurations).map(([k, v], i) => [k, turboFactor * v])
);

async function init() {
    const argv = await cli.argv();
    const i18next = await getI18Next();
    await $.ready;

    const autoViewport = new AutoViewport(window, {
        width: 1920,
        height: 1080,
        enable: true,
    });

    let turboMode = argv.turbo;

    const idleTimeoutMs = 5 * 60 * 1000;
    const idleDetector = new IdleDetector();
    idleDetector.setTimeout(reset, idleTimeoutMs);

    const audioContext = new AudioContext({sampleRate: SAMPLE_RATE});
    const micInputNode = await AudioRecorderNode.getMicrophoneAudioSource(audioContext);
    const recorderInputNode = new MicrophoneFilterNode(audioContext, {bypass: true});
    micInputNode.connect(recorderInputNode);

    const barkDetectorNode = new BarkDetectorNode(audioContext, {threshold: argv.volumeThreshold});
    micInputNode.connect(barkDetectorNode);
    barkDetectorNode.on('on', () => console.log("loud"));
    barkDetectorNode.on('off', () => console.log("silent"));

    const audioRecorderNode = new AudioRecorderNode(audioContext, {
        duration: AUDIO_DURATION_SEC * 1000,
        preRecordingDuration: 300,
    });
    recorderInputNode.connect(audioRecorderNode);
    const audioPlayer = new AudioPlayerNode(audioContext, {audioBuffer: audioRecorderNode.audioBuffer});
    audioPlayer.connect(audioContext.destination);
    const samples = audioRecorderNode.samples;

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
    const liveAnalyzer = audioContext.createAnalyser();
    recorderInputNode.connect(liveAnalyzer);

    const liveSamplesCb = (() => {
        let liveSamples = new Float32Array(0);
        return () => {
            liveSamples = liveSamples.length !== liveAnalyzer.fftSize ? new Float32Array(liveAnalyzer.fftSize) : liveSamples;
            liveAnalyzer.getFloatTimeDomainData(liveSamples);
            return liveSamples;
        }
    })();
    const waveformVisualizer = new WaveformVisualizer($waveformCanvas.get(0), samples, liveSamplesCb);
    const $spectrogramCanvasContainer = $('#spectrogram-viz .canvas-container');
    const $decodingContainer = $('#decoding-viz .decoding-container');
    const $textTransformationContainer = $('#text-transformation-viz .text-transformation-container');
    const networkVisualizer = new NetworkVisualizer(
        document.querySelector('#network-viz .network-container'),
        {
            cellSize: LETTER_CELL_SIZE,
            transitionDuration: animationDurations.networkTransition,
            autoplayDelay: animationDurations.networkDelay,
        }
    );
    const textTransformationVisualizer = new TextTransformationVisualizer(
        document.querySelector('#text-transformation-viz .text-transformation-container'),
        {cellSize: LETTER_CELL_SIZE, fontSize: FONT_SIZE, animationDuration: animationDurations.textTransform}
    );

    async function loadDemoAudio() {
        const audioBaseUrl = new URL(isPackaged() ? "../../../audio/" : "../../audio/", window.location.href);
        const audioUrl = new URL('helloiamai_16kHz_16bit_short.wav', audioBaseUrl);
        const demoAudioBuffer = await loadAudioFile(audioContext, audioUrl);
        audioRecorderNode.recordFromBuffer(demoAudioBuffer);
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



    const aq = new AnimationQueue();

    samples.on('length_changed', () => waveformVisualizer.cursorPosition = samples.length / samples.maxLength);
    audioPlayer.on('progress', (progress, duration) => waveformVisualizer.cursorPosition = progress / duration);
    audioPlayer.on('ended', () => {
        waveformVisualizer.cursorPosition = 2.0;
        audioPlayer.stop();
    });

    const samplesFullCb = async data => {
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
        const color = Color(window.getComputedStyle($spectrogramCanvasContainer.get(0)).color);
        const rgbaColor = [color.red(), color.green(), color.blue(), 255 * color.alpha()];
        const alphamap = ImageUtils.alphamapForRgba(rgbaColor);
        const alphamapInv = alpha => alphamap(1 - alpha);
        const spectrogramCanvas = ImageUtils.convert2DArrayToCanvas(window.predictionExt.layers[0], alphamap, {
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
        textTransformationVisualizer.animator.hideButtons();
        $textTransformationViz.hide();
        $decodingViz.hide();
        $networkViz.hide();
        $spectrogramViz.hide();

        const initialDurations = turboMode ? turboAnimationDurations : animationDurations;

        const delayAnim = () => new Promise(resolve => setTimeout(resolve, initialDurations.slideDelay));
        const slideDown = $elems => () => new Promise(resolve => $elems.slideDown(initialDurations.slideDown, resolve))

        aq.push(slideDown($spectrogramViz));
        aq.push(delayAnim);
        aq.push(slideDown($networkViz));
        aq.push(async () => await networkVisualizer.autoplay(initialDurations.networkTransition, initialDurations.networkDelay));
        aq.push(delayAnim);
        aq.push(slideDown($decodingViz));
        aq.push(delayAnim);
        aq.push(slideDown($textTransformationViz));
        aq.push(async () => await textTransformationVisualizer.animator.last(initialDurations.textTransform));
        aq.push(() => textTransformationVisualizer.animator.showButtons());

        aq.play();
    };
    samples.on('full', data => {
        waveformVisualizer.liveMode = false;
        waveformVisualizer.cursorPosition = 2.0;

        requestAnimationFrame(() => setTimeout(() => samplesFullCb(data), 0));
    });

    function reset() {
        audioRecorderNode.stopPreRecording();
        audioRecorderNode.stopRecording();
        audioPlayer.stop();

        aq.clear();

        samples.clear();
        waveformVisualizer.cursorPosition = -1;
        waveformVisualizer.liveMode = true;
        $spectrogramCanvasContainer.empty();
        networkVisualizer.clear();
        $decodingContainer.empty();
        textTransformationVisualizer.clear();

        $textTransformationViz.hide();
        $decodingViz.hide();
        $networkViz.hide();
        $spectrogramViz.hide();

        untoggleButton($recordButton);
        untoggleButton($playButton);
    }

    const $recordButton = $("#record-button");
    const $playButton = $("#play-button");
    const $restartButton = $("#restart-button");
    const $turboToggle = $("#turbo-toggle");

    function untoggleButton($button) {
        if ($button.hasClass('active'))
            $button.button('toggle');
    }

    $playButton.hide();

    samples.on('full', () => {
        $recordButton.hide();
        $playButton.show();
    });
    samples.on('empty', () => {
        untoggleButton($recordButton);
        untoggleButton($playButton);
        $playButton.hide();
        $recordButton.show();
    });
    audioRecorderNode.on('recording-stopped', () => $recordButton.button('toggle'));
    audioPlayer.on('ended', () => $playButton.button('toggle'));
    audioPlayer.on('paused', () => $playButton.button('toggle'));

    $recordButton.each((i, e) => new Hammer(e).on('tap', () => {
        if (barkDetectorNode.isOn) {
            audioRecorderNode.startRecording();
        } else {
            audioRecorderNode.startPreRecording();
            barkDetectorNode.once('on', () => audioRecorderNode.startRecording());
        }
    }));
    $playButton.each((i, e) => new Hammer(e).on('tap', () => audioPlayer.play()));
    $restartButton.each((i, e) => new Hammer(e).on('tap', reset));

    $turboToggle.bootstrapToggle(turboMode ? 'on' : 'off');
    $turboToggle.change(() => {
        turboMode = $turboToggle.prop('checked');
        console.log(turboMode);
    });

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

    async function setLanguage(lang, force) {
        // Avoid resetting if language did not change
        if (i18next.language === lang && !force)
            return;

        const namespace = 'frontend';
        await i18next.changeLanguage(lang);
        // find and select the first language in the fallback list that is actually supported
        for (lang of i18next.languages)
            if (i18next.hasResourceBundle(lang, namespace))
                break;
        await i18next.changeLanguage(lang);

        const t = i18next.getFixedT(lang, namespace);
        const elemsToLocalize = [
            {querySelector: "#text-transformation-viz .explanation", key: "short-expl.textTransformation"},
            {querySelector: "#decoding-viz .explanation", key: "short-expl.decoder"},
            {querySelector: "#network-viz .explanation", key: "short-expl.network"},
            {querySelector: "#spectrogram-viz .explanation", key: "short-expl.spectrogram"},
            {querySelector: "#waveform-viz .explanation", key: "short-expl.waveform"},
        ];
        elemsToLocalize.forEach(elem => $(elem.querySelector).html(t(elem.key)));
        $("#language-label").text(langmap[lang]["nativeName"]);
        reset();
    }

    addSupportedLanguages();
    const $languageButtons = $("#language-selector > a");
    $languageButtons.each((i, e) => new Hammer(e).on('tap', () => {
        const newLanguage = e.getAttribute("data-lang");
        if (newLanguage !== i18next.language)
            setLanguage(newLanguage);
    }));
    setLanguage(i18next.language, true);

    reset();
    if (argv.demo)
        await loadDemoAudio();
}

module.exports = {init: init};
