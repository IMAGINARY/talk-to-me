const IdleDetector = require('./idle-detector.js');
const CountdownOverlay = require("./countdown-overlay.js");

class IdleReloader {
    constructor(overlayElement, counterElement, idleTimeoutMs, countdown, reloadFunc) {
        this.idleTimeoutMs = idleTimeoutMs;
        this.countdown = countdown;
        this.reloadFunc = reloadFunc;
        this.countdownOverlay = new CountdownOverlay(overlayElement, counterElement);
        this.idleDetector = new IdleDetector();
        this.idleTimeoutId = 0;
        this.interruptedCb = () => this.countdownOverlay.abort();
    }

    async startObservation() {
        await this.stopObservation();
        if (this.idleTimeoutMs > 0) {
            const reloadAfterCountdown = async () => {
                try {
                    this.idleDetector.once('interrupted', this.interruptedCb);
                    await this.countdownOverlay.countdown(this.countdown);
                    await this.reloadFunc();
                } catch (err) {
                    this.idleDetector.removeListener('interrupted', this.interruptedCb);
                    await this.countdownOverlay.animateDone();
                    this.startObservation();
                }
            };
            this.idleTimeoutId = this.idleDetector.setTimeoutOnce(reloadAfterCountdown, this.idleTimeoutMs);
        }
        return this;
    }

    async stopObservation() {
        await this.countdownOverlay.abort().animateDone();
        this.idleDetector.clearTimeout(this.idleTimeoutId);
        return this;
    }
}

module.exports = IdleReloader;
