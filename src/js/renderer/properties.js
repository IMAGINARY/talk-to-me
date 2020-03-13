const properties = {
    supportedLanguages: ['en', 'de'],
    sampleRate: 16000,
    audioDuration: 2500,
    animationDurations: {
        moveViz: 1000,
        slideDown: 500,
        slideDelay: 2000,
        networkTransition: 300,
        networkDelay: 200,
        textTransform: 1000,
    },
    turboFactor: 0.025,
    styles: {
        recording: {
            waveformHeight: 513,
            vizBounds: {top: Math.floor((1080 - 513) / 2), left: 0, width: 1920},
        },
        recognition: {
            waveformHeight: 65,
            vizBounds: {top: 175, left: 20},
        },
    },
    topPredictionCount: 4,
};

function freeze(obj) {
    if (typeof obj === 'object' && obj !== null)
        Object.values(obj).forEach(o => freeze(o));
    return Object.freeze(obj);
}

freeze(properties);

module.exports = properties;
