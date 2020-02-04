const d3 = require('d3');
require('d3-selection-multi');

function visualizeDecoder(indices, letterProbabilities, alphabet, numBest, cellWidth, fontSizePx) {
    // TODO: Adjust font sizes relative to cellSize

    const margin = {top: 1, right: cellWidth, bottom: 1, left: cellWidth},
        width = letterProbabilities.shape[0] * cellWidth,
        height = numBest * fontSizePx,
        totalWidth = width + margin.left + margin.right,
        totalHeight = height + margin.top + margin.bottom;

    const svg = d3.create('svg')
        .attr("class", "decoding-viz")
        .attr("width", totalWidth)
        .attr("height", totalHeight);

    const diagram = svg.append("g")
        .attr("transform", `translate(${cellWidth},1)`);

    const gridLines = diagram.append("g")
        .attr("class", "grid");

    const gridLinesX = gridLines.append("g");
    for (let x = 0; x <= letterProbabilities.shape[0]; ++x) {
        gridLinesX.append("line")
            .attrs({x1: x * cellWidth, y1: 0, x2: x * cellWidth, y2: height});
    }

    const gridLinesY = gridLines.append("g");
    for (let y = 0; y <= letterProbabilities.shape[1]; ++y) {
        gridLinesY.append("line")
            .attrs({x1: 0, y1: y * fontSizePx, x2: width, y2: y * fontSizePx});
    }

    const lineHeight = fontSizePx;
    const charWidth = width / indices.shape[0];
    for (let position = 0; position < indices.shape[0]; ++position) {
        const bestK = indices.pick(position).hi(numBest);
        for (let lineNum = 0; lineNum < bestK.shape[0]; ++lineNum) {
            const charIndex = bestK.get(lineNum);
            const char = alphabet[charIndex];
            const opacity = letterProbabilities.get(position, charIndex);

            diagram.append("text")
                .attr("class", "letters")
                .attrs({
                    x: (position + 0.5) * charWidth,
                    y: (lineNum + 1 - 0.175) * lineHeight,
                    opacity: opacity,
                })
                .text(char)
        }
    }

    return svg.node();
}

module.exports = visualizeDecoder;
