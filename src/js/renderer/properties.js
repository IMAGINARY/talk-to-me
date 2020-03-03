const properties = {
    supportedLanguages: ['en', 'de'],
    sampleRate: 16000,
    audioDuration: 2500,
    animationDurations: {
        movViz: 1000,
        slideDown: 500,
        slideDelay: 2000,
        networkTransition: 300,
        networkDelay: 200,
        textTransform: 1000,
    },
    turboFactor: 0.025,
    styles: {
    },
};

function freeze(obj) {
    if (typeof obj === 'object' && obj !== null)
        Object.values(obj).forEach(o => freeze(o));
    return Object.freeze(obj);
}

freeze(properties);

module.exports = properties;
