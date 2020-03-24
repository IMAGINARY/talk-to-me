const VIZ_MARGIN = Number(getComputedStyle(document.documentElement)
    .getPropertyValue('--viz-margin')
    .replace(/px$/, ""));

const properties = {
    supportedLanguages: ['en', 'de'],
    sampleRate: 16000,
    audioDuration: 2500,
    animationDurations: {
        moveViz: 1000,
        slideDown: 500,
        networkTransition: 300,
        networkDelay: 200,
        textTransform: 1000,
        minSpectrogram: 7000,
        minNetwork: 10000,
        minDecoding: 5000,
        minTextTransform: 1000,
    },
    turboFactor: 0.2,
    styles: {
        recording: {
            waveformHeight: 513,
            vizBounds: {top: Math.floor((1080 - 513) / 2), left: -VIZ_MARGIN, width: 1920 + 2 * VIZ_MARGIN},
        },
        recognition: {
            waveformHeight: 65,
            vizBounds: {top: 175, left: 20},
        },
    },
    topPredictionCount: 4,
    resetCountdown: 10,
};

function freeze(obj) {
    if (typeof obj === 'object' && obj !== null)
        Object.values(obj).forEach(o => freeze(o));
    return Object.freeze(obj);
}

freeze(properties);

module.exports = properties;
