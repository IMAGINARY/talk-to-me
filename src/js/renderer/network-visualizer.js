const assert = require('assert');
const Color = require('color');
const ImageUtils = require('../common/util/image-utils.js');

const $ = require('jquery');
const Swiper = require('swiper');
const d3 = require('d3');
require('d3-selection-multi');

function visualizeLetterProbabilities(letterProbabilties, alphabet, cellSize) {
    // TODO: Adjust font sizes relative to cellSize

    const margin = {top: 1, right: cellSize, bottom: 1, left: cellSize},
        width = letterProbabilties.shape[0] * cellSize,
        height = letterProbabilties.shape[1] * cellSize,
        totalWidth = width + margin.left + margin.right,
        totalHeight = height + margin.top + margin.bottom;

    const svg = d3.create('svg')
        .attr("class", "letter-probability-viz")
        .attr("width", totalWidth)
        .attr("height", totalHeight);

    const diagram = svg.append("g")
        .attr("transform", `translate(${cellSize},1)`);

    const gridLines = diagram.append("g")
        .attr("class", "grid");

    const gridLinesX = gridLines.append("g");
    for (let x = 0; x <= letterProbabilties.shape[0]; ++x) {
        gridLinesX.append("line")
            .attrs({x1: x * cellSize, y1: 0, x2: x * cellSize, y2: height});
    }

    const gridLinesY = gridLines.append("g");
    for (let y = 0; y <= letterProbabilties.shape[1]; ++y) {
        gridLinesY.append("line")
            .attrs({x1: 0, y1: y * cellSize, x2: width, y2: y * cellSize});
    }

    const letters = diagram.append("g")
        .attr("class", "monospaced");

    const legendLeft = true;
    const legendRight = false;
    for (let l = 0; l < letterProbabilties.shape[1]; ++l) {
        const char = alphabet[l];
        if (legendLeft) {
            letters.append("text")
                .attr("class", "legend")
                .attrs({
                    x: -0.5 * cellSize,
                    y: (l + 1 - 0.25) * cellSize,
                })
                .text(char);
        }
        for (let t = 0; t < letterProbabilties.shape[0]; ++t) {
            const opacity = letterProbabilties.get(t, l);
            letters.append("rect")
                .attrs({
                    x: t * cellSize,
                    y: l * cellSize,
                    width: cellSize,
                    height: cellSize,
                    opacity: opacity,
                });
            letters.append("text")
                .attr("class", "letters")
                .attrs({
                    x: (t + 0.5) * cellSize,
                    y: (l + 1 - 0.25) * cellSize,
                })
                .text(char)
        }
        if (legendRight) {
            letters.append("text")
                .attr("class", ".legend")
                .attrs({
                    x: (letterProbabilties.shape[0] + 0.5) * cellSize,
                    y: (l + 1 - 0.25) * cellSize,
                })
                .text(char);
        }
    }

    return svg.node();
}

class NetworkVisualizer {
    constructor(domElement, options) {
        this._parent = domElement;
        this._swiperContainer = document.createElement('div');
        this._swiperContainer.classList.add('swiper-container');
        this._parent.append(this._swiperContainer);

        const defaultOptions = {
            cellSize: 11,
            transitionDuration: 300,
            autoplayDelay: 100,
        };
        this._options = Object.assign(defaultOptions, options);
    }

    setLayers(layers, alphabet) {
        assert(layers.length >= 2, "Network needs at least input and output layers");

        // clear parent element
        this.clear();

        // add new slides
        const color = Color(window.getComputedStyle(this._swiperContainer).color);
        const rgbaColor = [color.red(), color.green(), color.blue(), 255 * color.alpha()];
        const alphamap = ImageUtils.alphamapForRgba(rgbaColor);
        const alphamapInv = alpha => alphamap(1 - alpha);
        const layerConversionOptions = {
            normalize: true,
            flipV: true,
        };
        const $swiperWrapper = $('<div></div>').addClass('swiper-wrapper');
        for (let l = 1; l < layers.length - 1; ++l) {
            const $layerCanvas = $(ImageUtils.convert2DArrayToCanvas(layers[l], alphamap, layerConversionOptions))
                .addClass('full-size')
                .css('image-rendering', "pixelated");
            const $slide = $('<div></div>')
                .addClass('swiper-slide')
                .addClass('needs-padding')
                .append($layerCanvas);
            $swiperWrapper.append($slide);
        }

        // add letter probability diagram
        const svg = visualizeLetterProbabilities(layers[layers.length - 1], alphabet, this._options.cellSize);
        const $slide = $('<div></div>')
            .addClass('swiper-slide')
            .append(svg);
        $swiperWrapper.append($slide);

        // add pagination bullets
        const $swiperPagination = $('<div></div>')
            .addClass("swiper-pagination");

        // add scrollbar
        const $swiperScrollbar = $('<div></div>')
            .addClass("swiper-scrollbar");

        $(this._swiperContainer).append(
            $swiperWrapper,
            $swiperPagination,
            $swiperScrollbar,
        );

        // the letter probability diagram defines the overall size
        $(this._swiperContainer)
            .css("width", `${svg.getAttribute("width")}px`)
            .css("height", `${svg.getAttribute("height")}px`);

        // init slider
        const swiper = new Swiper(this._swiperContainer, {
            direction: 'vertical',
            centeredSlides: true,
            slidesPerView: 1,
            effect: 'fade',
            speed: this._options.transitionDuration,
            fadeEffect: {
                crossFade: true
            },
            autoplay: {
                delay: this._options.autoplayDelay,
                stopOnLastSlide: true,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.swiper-pagination',
                renderBullet: function (index, className) {
                    return '<span class="' + className + '">' + (index + 1) + '</span>';
                },
            },
            scrollbar: {
                el: '.swiper-scrollbar',
                hide: false,
                draggable: true,
            },
            mousewheelControl: true,
        });
        swiper.autoplay.stop();
    }

    async autoplay(transitionDuration, autoplayDelay) {
        if (typeof this._swiperContainer.swiper !== "undefined" && this._swiperContainer.swiper !== null) {
            const swiper = this._swiperContainer.swiper;
            if (transitionDuration === 0.0 && autoplayDelay === 0.0) {
                swiper.slideTo(swiper.slides.length - 1, 0.0);
                await new Promise(resolve => setTimeout(resolve, 0));
            } else {
                const oldTransitionDuration = swiper.params.speed;
                const oldAutoplayDelay = swiper.params.autoplay.delay;
                swiper.params.speed = typeof transitionDuration === "number" ? transitionDuration : oldTransitionDuration;
                swiper.params.autoplay.delay = typeof autoplayDelay === "number" ? autoplayDelay : oldAutoplayDelay;
                await new Promise(resolve => {
                    swiper.once('autoplayStop', resolve);
                    swiper.autoplay.start();
                });
                swiper.params.speed = oldTransitionDuration;
                swiper.params.autoplay.delay = oldAutoplayDelay;
            }
        } else {
            await Promise.resolve();
        }
    }

    clear() {
        if (typeof this._swiperContainer.swiper !== "undefined" && this._swiperContainer.swiper !== null)
            this._swiperContainer.swiper.destroy();
        $(this._swiperContainer).empty();
    }
}

module
    .exports = NetworkVisualizer;
