const domReady = new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve));

async function loadApp() {
    try {
        const $ = jQuery = require('jquery');
        const bootstrap = require('bootstrap');
        const bootstrapToggle = require('bootstrap4-toggle');

        const app = require('../js/renderer/app.js');
        await app.init();
    } finally {
        await domReady;
    }
}

// load the app and make sure the page content is faded in regardless of successful initialization or possible errors
// (initially, the document body has opacity 0.0 to make the app loading look smoother)
loadApp()
    .then(() => console.log("Initialization complete"))
    .finally(() => document.body.classList.add('fade-in'));
