const assert = require('assert');
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

    for (let l = 0; l < letterProbabilties.shape[1]; ++l) {
        const char = alphabet[l];
        diagram.append("text")
            .attr("class", ".legend")
            .attrs({
                x: -0.5 * cellSize,
                y: (l + 1 - 0.25) * cellSize,
            })
            .text(char)
        for (let t = 0; t < letterProbabilties.shape[0]; ++t) {
            const opacity = letterProbabilties.get(t, l);
            diagram.append("rect")
                .attrs({
                    x: t * cellSize,
                    y: l * cellSize,
                    width: cellSize,
                    height: cellSize,
                    opacity: opacity,
                });
            diagram.append("text")
                .attr("class", "letters")
                .attrs({
                    x: (t + 0.5) * cellSize,
                    y: (l + 1 - 0.25) * cellSize,
                })
                .text(char)
        }
        diagram.append("text")
            .attr("class", ".legend")
            .attrs({
                x: (letterProbabilties.shape[0] + 0.5) * cellSize,
                y: (l + 1 - 0.25) * cellSize,
            })
            .text(char)
    }

    return svg.node();
}

class NetworkVisualizer {
    constructor(domElement) {
        this._parent = domElement;
        this._swiperContainer = document.createElement('div');
        this._swiperContainer.classList.add('swiper-container');
        this._parent.append(this._swiperContainer);
    }

    setLayers(layers, alphabet) {
        assert(layers.length >= 2, "Network needs at least input and output layers");

        // clear parent element
        this.clear();

        // add new slides
        const layerConversionOptions = {
            normalize: true,
            flipV: true,
        };
        const $swiperWrapper = $('<div></div>').addClass('swiper-wrapper');
        for (let l = 1; l < layers.length - 1; ++l) {
            const $layerCanvas = $(ImageUtils.convert2DArrayToCanvas(layers[l], ImageUtils.alphamap, layerConversionOptions))
                .addClass('full-size')
                .css('image-rendering', "pixelated");
            const $slide = $('<div></div>')
                .addClass('swiper-slide')
                .addClass('needs-padding')
                .append($layerCanvas);
            $swiperWrapper.append($slide);
        }

        // add letter probability diagram
        const svg = visualizeLetterProbabilities(layers[layers.length - 1], alphabet, 11);
        const $slide = $('<div></div>')
            .addClass('swiper-slide')
            .append(svg);
        $swiperWrapper.append($slide);

        $(this._swiperContainer).append($swiperWrapper);

        // the letter probability diagram defines the overall size
        console.log(svg, this._swiperContainer);
        $(this._swiperContainer)
            .css("width", `${svg.getAttribute("width")}px`)
            .css("height", `${svg.getAttribute("height")}px`);

        // init slider
        const swiper = new Swiper(this._swiperContainer, {
            centeredSlides: true,
            slidesPerView: 1,
            effect: 'fade',
            fadeEffect: {
                crossFade: true
            },
            autoplay: {
                delay: 100,
                stopOnLastSlide: true,
            },
        });

        global.swiper = swiper;
    }

    clear() {
        if (typeof this._swiperContainer.swiper !== "undefined")
            this._swiperContainer.swiper.destroy();
        $(this._swiperContainer).empty();
    }
}

module
    .exports = NetworkVisualizer;
