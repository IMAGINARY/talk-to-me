"use strict";

const assert = require('assert');
const cli = require('../common/cli.js');
const getI18Next = require('../common/i18n.js');
const langmap = require('langmap');
const Color = require('color');
const IdleReloader = require("./idle-reloader.js");
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
const decodingVisualizerFunc = require("./decoding-visualizer.js");
const TextTransformationVisualizer = require("./text-transformation-visualizer.js");
const NetworkVisualizer = require("./network-visualizer.js");

const AnimationQueue = require('./animation-queue.js');

const props = require('./properties.js');

const SAMPLE_RATE = props.sampleRate;
const AUDIO_DURATION_SEC = props.audioDuration / 1000.0;

const supportedLanguages = props.supportedLanguages;
const modelLoadedPromise = Promise.all(supportedLanguages
    .map(lang => wav2letter.transcribe({waveform: new Float32Array(), lang: lang})))
    .then(() => console.log("Speech recognition models loaded."));
const w2lOutputLengthPromise = modelLoadedPromise
    .then(() => wav2letter.computeOutputLength(AUDIO_DURATION_SEC * SAMPLE_RATE));

function computeAnimationDurations(speedup) {
    return Object.fromEntries(
        Object.entries(props.animationDurations).map(([k, v], i) => [k, speedup * v])
    );
}

const states = {
    RECORDING: 0,
    RECOGNITION: 1,
};

async function init() {
    const argv = await cli.argv();
    window.argv = argv;
    const i18next = await getI18Next();
    await $.ready;

    const autoViewport = new AutoViewport(window, {
        width: 1920,
        height: 1080,
        enable: true,
    });

    let state = states.RECORDING;
    let animationSpeedUp = 1.0;

    const idleReloader = new IdleReloader(
        document.querySelector("#reset-overlay"),
        document.querySelector("#reset-counter"),
        argv.idleTimeout * 1000,
        props.resetCountdown,
        () => withFade(reloadWithInitialSettings()),
    );

    const audioContext = new AudioContext({sampleRate: SAMPLE_RATE});
    window.audioContext = audioContext;
    const micInputNodeBefore = await AudioRecorderNode.getMicrophoneAudioSource(audioContext);
    window.mic = micInputNodeBefore;
    window.inBetweenNode = audioContext.createGain();
    micInputNodeBefore.connect(inBetweenNode);
    const micInputNode = inBetweenNode;

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

    const $title = $("#title");
    const $recordButtonContainer = $("#record-button-container");
    const $vizContainer = $("#viz-container");
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
    //$waveformCanvas.attr("width", LETTER_CELL_SIZE * W2L_OUTPUT_LENGTH);
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
            transitionDuration: props.animationDurations.networkTransition,
            autoplayDelay: props.animationDurations.networkDelay,
        }
    );
    const textTransformationVisualizer = new TextTransformationVisualizer(
        document.querySelector('#text-transformation-viz .text-transformation-container'),
        {cellSize: LETTER_CELL_SIZE, fontSize: FONT_SIZE, animationDuration: props.animationDurations.textTransform}
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

    function enableSettingsUI(enable) {
        if (enable) {
            $turboToggle.bootstrapToggle('enable');
            $languageButton.removeClass('disabled');
        } else {
            $turboToggle.bootstrapToggle('disable');
            $languageButton.addClass('disabled');
        }
    }

    async function transitionToRecognition(speedup) {
        const animationDurations = computeAnimationDurations(speedup);

        const vizBoundsRecognition = Object.assign({}, props.styles.recognition.vizBounds, {width: LETTER_CELL_SIZE * (W2L_OUTPUT_LENGTH + 2)});

        const makeRoom = () => {
            const cssAnimPromise = new Promise(resolve => $title.one('animationend', resolve));
            $title.css('animation-duration', `${animationDurations.moveViz}ms`);
            $title.addClass('recognition');
            return Promise.all([
                $recordButtonContainer.fadeOut(animationDurations.moveViz).promise(),
                cssAnimPromise,
            ]);
        };
        const moveVizUp = () => Promise.all([
            $vizContainer.animate(vizBoundsRecognition, animationDurations.moveViz).promise(),
            $waveformCanvas.animate({height: props.styles.recognition.waveformHeight}, animationDurations.moveViz).promise(),
        ]).then(() => $waveformCanvas.attr({height: $waveformCanvas.height(), width: $waveformCanvas.width()}));

        aq.push(AnimationQueue.skipFrame());
        aq.push(makeRoom);
        aq.push(moveVizUp);
        aq.push(AnimationQueue.skipFrame());

        await aq.play();
    }

    async function recognize(data) {
        const languages = i18next.languages.filter(l => supportedLanguages.includes(l));
        assert(languages.length > 0, `No supported language in ${i18next.languages}. Must include one of ${supportedLanguages}.`);

        window.waveform = data;
        window.predictionExt = await wav2letter.predictExt({waveform: data, lang: languages[0]});
        window.predictionExt.letters = toUpperCase(window.predictionExt.letters);

        return predictionExt;
    }

    function visualizeSpectrogram(predictionExt) {
        const color = Color(window.getComputedStyle($spectrogramCanvasContainer.get(0)).color);
        const rgbaColor = [color.red(), color.green(), color.blue(), 255 * color.alpha()];
        const alphamap = ImageUtils.alphamapForRgba(rgbaColor);
        const alphamapInv = alpha => alphamap(1 - alpha);
        const spectrogramCanvas = ImageUtils.convert2DArrayToCanvas(predictionExt.layers[0], alphamap, {
            clearBeforeDrawing: true,
            flipV: true,
            normalize: true,
        });
        $spectrogramCanvasContainer.empty();
        $spectrogramCanvasContainer.append(spectrogramCanvas);
    }

    function visualizeNetwork(predictionExt) {
        networkVisualizer.setLayers(predictionExt.layers, window.predictionExt.letters);
    }

    function visualizeDecoding(decodedPredictionExt) {
        const decoderSvg = decodingVisualizerFunc(
            decodedPredictionExt.indices,
            decodedPredictionExt.probabilities,
            decodedPredictionExt.alphabet,
            props.topPredictionCount,
            LETTER_CELL_SIZE,
            FONT_SIZE,
        );
        $decodingContainer.empty();
        $decodingContainer.append(decoderSvg);
    }

    function visualizeTextTransformation(decodedPredictionExt) {
        textTransformationVisualizer.setRaw(decodedPredictionExt.indices, decodedPredictionExt.alphabet);
    }

    function visualizeRecognition(predictionExt) {
        const decodedPredictionExt = decodePredictionExt(predictionExt);

        // briefly show the viz containers to allow certain layout calculations
        const vizContainers = [$spectrogramViz, $networkViz, $decodingViz, $textTransformationViz];
        vizContainers.forEach($c => $c.show());

        // add the new visualizations
        visualizeSpectrogram(predictionExt);
        visualizeNetwork(predictionExt);
        visualizeDecoding(decodedPredictionExt);
        visualizeTextTransformation(decodedPredictionExt);

        // hide the viz containers before starting animations
        textTransformationVisualizer.animator.hideButtons();
        vizContainers.forEach($c => $c.hide());
    }

    async function animateRecognition(speedup) {
        const animationDurations = computeAnimationDurations(speedup);

        const delayAnim = AnimationQueue.delay(animationDurations.slideDelay);
        const slideDown = $elems => () => $elems.slideDown(animationDurations.slideDown).promise();

        aq.push(delayAnim);
        aq.push(slideDown($spectrogramViz));
        aq.push(delayAnim);
        aq.push(slideDown($networkViz));
        aq.push(async () => await networkVisualizer.autoplay(animationDurations.networkTransition, animationDurations.networkDelay));
        aq.push(delayAnim);
        aq.push(slideDown($decodingViz));
        aq.push(delayAnim);
        aq.push(slideDown($textTransformationViz));
        aq.push(async () => await textTransformationVisualizer.animator.last(animationDurations.textTransform));
        aq.push(() => textTransformationVisualizer.animator.showButtons());
        aq.push(delayAnim);
        aq.push(() => Promise.all([
            argv.hidePlayButton ? Promise.resolve() : $playButton.fadeIn().promise(),
            $restartButton.fadeIn().promise(),
        ]));

        await aq.play();
    }

    samples.on('full', async waveformData => {
        enableSettingsUI(false);

        await idleReloader.stopObservation();

        waveformVisualizer.liveMode = false;
        waveformVisualizer.cursorPosition = 2.0;

        await transitionToRecognition(animationSpeedUp);
        state = states.RECOGNITION;
        const predictionExt = await recognize(waveformData);
        visualizeRecognition(predictionExt);
        await animateRecognition(animationSpeedUp);

        await idleReloader.startObservation();

        enableSettingsUI(true);
    });

    function resetRecognition() {
        $textTransformationViz.hide();
        $decodingViz.hide();
        $networkViz.hide();
        $spectrogramViz.hide();

        resetPlayButton();

        $playButton.hide();
        $restartButton.hide();
    }

    function reset() {
        idleReloader.stopObservation();
        resetRecognition();

        audioRecorderNode.stopPreRecording();
        audioRecorderNode.stopRecording();
        audioPlayer.stop();

        samples.clear();
        waveformVisualizer.cursorPosition = -1;
        waveformVisualizer.liveMode = true;
        $spectrogramCanvasContainer.empty();
        networkVisualizer.clear();
        $decodingContainer.empty();
        textTransformationVisualizer.clear();

        $title.removeClass('recognition');
        $vizContainer.css(props.styles.recording.vizBounds);
        $waveformCanvas.css({height: props.styles.recording.waveformHeight});
        $recordButtonContainer.show();
        $waveformCanvas.attr({height: $waveformCanvas.height(), width: $waveformCanvas.width()});

        resetRecordButton();
        $recordButtonContainer.show();

        enableSettingsUI(true);

        idleReloader.startObservation();

        state = states.RECORDING;
    }

    async function reloadWithSameSettings() {
        // The promise will never settle.
        // This helps ensuring that the app is able to wait until the reloading actually happens.
        await new Promise(() => window.location.reload());
    }

    async function reloadWithInitialSettings() {
        // restore initial settings
        argv.lang = argv.initialLang;
        argv.turbo = argv.initialTurbo;
        // reload with the current (=initial) settings
        await reloadWithSameSettings();
    }

    async function withFade(func) {
        const aq = new AnimationQueue();
        aq.push(AnimationQueue.skipFrame());
        aq.push(() => $(document.body).animate({opacity: 0.0}).promise());
        aq.push(AnimationQueue.skipFrame());
        aq.push(() => Promise.resolve().then(func));
        aq.push(AnimationQueue.skipFrame());
        aq.push(() => $(document.body).animate({opacity: 1.0}).promise());
        aq.push(AnimationQueue.skipFrame());
        await aq.play();
    }

    const recordButton = document.querySelector("#record-button");
    const volumeIndicator = document.querySelector("#volume-indicator");
    const playButton = document.querySelector("#play-button"), $playButton = $(playButton);
    const restartButton = document.querySelector("#restart-button"), $restartButton = $(restartButton);
    const turboToggle = document.querySelector("#turbo-toggle"), $turboToggle = $(turboToggle);

    const hammerRecordButton = new Hammer(recordButton);
    hammerRecordButton.get('press').set({time: 0});

    function volumeChangeCb(currentVolume, threshold) {
        const percent = 100 * ((100 + currentVolume) / (100 + threshold));
        volumeIndicator.style.clipPath = `inset(${100 - percent}% 0px 0px 0px)`;
    }

    function startRecordingCb() {
        idleReloader.stopObservation();
        barkDetectorNode.removeListener('volume_change', volumeChangeCb);
        volumeChangeCb(0, 0);
        audioRecorderNode.startRecording();
    }

    function resetRecordButton() {
        volumeChangeCb(-100, 0);
        barkDetectorNode.removeListener('volume_change', volumeChangeCb);
        audioRecorderNode.removeListener('recording-stopped', resetRecordButton);
        barkDetectorNode.removeListener('on', startRecordingCb);
        recordButton.classList.remove('active');
        hammerRecordButton.off('press');
        hammerRecordButton.on('press', () => {
            enableSettingsUI(false);
            hammerRecordButton.off('press');
            recordButton.classList.add('active');
            barkDetectorNode.reset();
            audioRecorderNode.startPreRecording();
            barkDetectorNode.once('on', startRecordingCb);
            barkDetectorNode.on('volume_change', volumeChangeCb);
        });
    }

    const hammerPlayButton = new Hammer(playButton);

    function resetPlayButton() {
        audioPlayer.removeListener('ended', resetPlayButton);
        playButton.classList.remove('active');
        hammerPlayButton.off('tap');
        hammerPlayButton.on('tap', () => {
            hammerPlayButton.off('tap');
            playButton.classList.add('active');
            audioPlayer.once('ended', resetPlayButton);
            audioPlayer.play();
        });
    }

    const hammerRestartButton = new Hammer(restartButton);
    hammerRestartButton.on('tap', () => withFade(reloadWithSameSettings));

    function setTurbo(enabled) {
        argv.turbo = enabled;
        animationSpeedUp = enabled ? props.turboFactor : 1.0;
    }

    $turboToggle.bootstrapToggle(argv.turbo ? 'on' : 'off');
    $turboToggle.change(() => setTurbo($turboToggle.prop('checked')));
    setTurbo(argv.turbo);

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

        enableSettingsUI(false);

        const changeLanguageAndGetT = async lang => {
            const namespace = 'frontend';

            await i18next.changeLanguage(lang);
            // find and select the first language in the fallback list that is actually supported
            for (lang of i18next.languages)
                if (i18next.hasResourceBundle(lang, namespace))
                    break;
            await i18next.changeLanguage(lang);
            argv.lang = lang;

            return i18next.getFixedT(lang, namespace);
        };

        const localizeTexts = async t => {
            const elemsToLocalize = [
                {querySelector: "#title", key: "title"},
                {querySelector: "#text-transformation-viz .explanation", key: "short-expl.textTransformation"},
                {querySelector: "#decoding-viz .explanation", key: "short-expl.decoder"},
                {querySelector: "#network-viz .explanation", key: "short-expl.network"},
                {querySelector: "#spectrogram-viz .explanation", key: "short-expl.spectrogram"},
                {querySelector: "#waveform-viz .explanation", key: "short-expl.waveform"},
                {querySelector: "#reset-overlay .counter-label", key: "reset.counter"},
                {querySelector: "#reset-overlay .cancel-label", key: "reset.cancel"},
            ];
            elemsToLocalize.forEach(elem => $(elem.querySelector).html(t(elem.key)));
            $("#turbo-toggle").bootstrapToggle('destroy');
            $("#turbo-toggle").bootstrapToggle({
                on: t("label.toggleTurboModeOn"),
                off: t("label.toggleTurboModeOff"),
            });
            $("#language-label").text(langmap[i18next.language]["nativeName"]);
        };

        if (state === states.RECOGNITION) {
            resetRecognition();
            const t = await changeLanguageAndGetT(lang);
            const predictionExtPromise = recognize(samples.data);
            await localizeTexts(t);
            visualizeRecognition(await predictionExtPromise);
            await animateRecognition(0.0);
        } else {
            await localizeTexts(await changeLanguageAndGetT(lang));
        }

        enableSettingsUI(true);
    }

    addSupportedLanguages();
    const $languageButton = $("#language-button");
    const $languageButtons = $("#language-selector > a");
    $languageButtons.each((i, e) => new Hammer(e).on('tap', () => {
        const newLanguage = e.getAttribute("data-lang");
        if (newLanguage !== i18next.language)
            setLanguage(newLanguage);
    }));
    setLanguage(argv.lang, true);

    reset();
    if (argv.demo)
        await loadDemoAudio();
}

module.exports = {init: init};
