const assert = require('assert');
const $ = require('jquery');

class CountdownOverlay {
    constructor(overlayElement, counterElement) {
        this.$overlayElement = $(overlayElement);
        this.$counterElement = $(counterElement);
        this.counter = 0;
        this.intervalId = 0;
        const sentinelFunc = _ => _;
        this.rejectFunc = sentinelFunc;
        this.resolveFunc = sentinelFunc;
    }

    async countdown(seconds) {
        assert(typeof seconds === 'number');
        this.abort();

        this.counter = seconds;
        this.$counterElement.text(this.counter);

        const fadeInPromise = this.$overlayElement.fadeIn().promise();

        const counterPromise = new Promise((resolve, reject) => {
            this.resolveFunc = resolve;
            this.rejectFunc = reject;
            this.intervalId = setInterval(this._update.bind(this), 1000);
        });

        await fadeInPromise;
        await counterPromise;

        return this;
    }

    abort() {
        clearInterval(this.intervalId);
        this.rejectFunc();
        return this;
    }

    async animateDone() {
        this.abort();
        await this.$overlayElement.fadeOut().promise();
        return this;
    }

    done() {
        this.abort();
        this.$overlayElement.hide();
        return this;
    }

    _update() {
        this.counter -= 1;
        this.$counterElement.text(this.counter);
        if (this.counter === 0) {
            clearInterval(this.intervalId);
            this.resolveFunc();
        }
    }
}

module.exports = CountdownOverlay;
