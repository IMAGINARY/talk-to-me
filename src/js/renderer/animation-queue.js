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

module.exports = AnimationQueue;
