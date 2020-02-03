const path = require('path');
const i18next = require('i18next');
const backend = require('i18next-node-fs-backend');
const languageDetector = require('i18next-cli-language-detector').default; // needed because the module uses ES6 default exports

const localeBasePath = path.resolve(__dirname, "../../locales");

const options = {
    backend: {
        loadPath: localeBasePath + "/{{lng}}/{{ns}}.json"
    },
    fallbackLng: 'en',
    ns: ['frontend', 'cli'],
};

const initPromise = i18next
    .use(languageDetector)
    .use(backend)
    .init(options)
    .then(t => i18next);

module.exports = () => initPromise;
