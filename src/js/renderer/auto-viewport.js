class AutoViewport {
    constructor(window, options) {
        const defaultOptions = {
            enable: false,
            width: 0,
            height: 0,
            align: 'center',
            verticalAlign: 'middle',
        };

        this._window = window;
        this._options = Object.assign(defaultOptions, options);
        this._resizeHandler = () => this._zoom();

        if (this._options.enable)
            this.enable();
    }

    enable() {
        window.addEventListener('resize', this._resizeHandler);
        this._zoom();
    }

    disable() {
        window.removeEventListener('resize', this._resizeHandler);
        document.body.style.transformOrigin = '';
        document.body.style.transform = '';
    }

    setViewport(width, height) {
        this._options.width = width;
        this._options.height = height;
        this._zoom();
    }

    setAlignment(horizontal, vertical) {
        if (horizontal !== null)
            this._options.align = horizontal;
        if (vertical !== null)
            this._options.verticalAlign = vertical;
        this._zoom();
    }

    get width() {
        return this._options.width;
    }

    get height() {
        return this._options.height;
    }

    static _computeZoomFactor(targetWidth, targetHeight, width, height) {
        const widthRatio = targetWidth / width;
        const heightRatio = targetHeight / height;
        const ratio = Math.min(widthRatio, heightRatio);
        return Number.isFinite(ratio) ? ratio : 1;
    }

    static _computeAlignmentOffset(mode, availableLength, actualLength) {
        switch (mode.toLowerCase()) {
            case 'left':
            case 'top':
                return 0;
            case 'center':
            case 'middle':
            default:
                return (availableLength - actualLength) / 2;
            case 'right':
            case 'bottom':
                return availableLength - actualLength;
        }
    }

    _zoom() {
        const win = this._window;
        const width = this._options.width === 0 ? win.innerWidth : this._options.width;
        const height = this._options.height === 0 ? win.innerHeight : this._options.height;
        const ratio = AutoViewport._computeZoomFactor(win.innerWidth, win.innerHeight, width, height);
        const xOffset = AutoViewport._computeAlignmentOffset(this._options.align, win.innerWidth, width * ratio);
        const yOffset = AutoViewport._computeAlignmentOffset(this._options.verticalAlign, win.innerHeight, height * ratio);
        document.body.style.transformOrigin = 'top left';
        document.body.style.transform = `translate(${xOffset}px, ${yOffset}px) scale(${ratio})`;
    }
}

module.exports = AutoViewport;
