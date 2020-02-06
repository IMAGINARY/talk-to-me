const $ = require('jquery');
const d3 = require('d3');
require('d3-selection-multi');
require('d3-transition');

class Char {
    static _lastKey = -1;

    constructor(key, char, position) {
        this.key = key;
        this.char = char;
        this.position = position;
    }

    static createKey() {
        ++Char._lastKey;
        return "c" + Char._lastKey;
    }
}

function convertStringToCharArray(string) {
    return Array.from(string).map((c, idx) => new Char(Char.createKey(), c, idx));
}

function convertRawToString(indices, alphabet) {
    const bestIndices = indices.pick(null, 0);
    return new Array(bestIndices.shape[0])
        .fill()
        .map((_, idx) => alphabet[bestIndices.get(idx)])
        .join('');
}

function removeGarbage1(charArray) {
    const firstGarbageIndex = charArray.findIndex(c => c.char === '·');
    charArray = [...charArray];
    if (firstGarbageIndex >= 0)
        charArray.splice(firstGarbageIndex, 1);
    return {
        charArray: charArray,
        modified: firstGarbageIndex >= 0,
    };
}

function removeGarbage_n(charArray) {
    const garbageRemoved = charArray.filter(c => c.char !== '·' && c.char !== '\'');
    const positionsUpdated = positionByIndex_1(garbageRemoved);
    return [garbageRemoved, positionsUpdated];
}

function map23To33_n(charArray) {
    return [map32To33_1([...charArray].reverse()).reverse()];
}

function map32To33_1(charArray) {
    const result = [...charArray];
    for (let i = 1; i < result.length; ++i) {
        if (result[i - 1].char === '³' && result[i].char === '²')
            result[i] = new Char(result[i].key, '³', result[i].position);
    }
    return result;
}

function map32To33_n(charArray) {
    return [map32To33_1(charArray)];
}

function mergeDuplicates_n(charArray) {
    const result = [...charArray];
    for (let i = 1; i < result.length; ++i) {
        if (result[i - 1].char === result[i].char)
            result[i] = new Char(result[i].key, result[i].char, result[i - 1].position);
    }
    return [result];
}

function removeDuplicates_n(charArray) {
    const duplicatesRemoved = charArray.filter((c, idx) => idx === 0 || c.char !== charArray[idx - 1].char);
    const positionsUpdated = duplicatesRemoved.map((c, idx) => c.position === idx ? c : new Char(c.key, c.char, idx));
    return [duplicatesRemoved, positionsUpdated];
}

function removePrefix_1(charArray, prefixChar) {
    const tmp = [...charArray];
    while (tmp.length > 0 && tmp[0].char === prefixChar) {
        tmp.shift();
    }
    return tmp;
}

function replace2_n(charArray) {
    const withoutPrefix2 = removePrefix_1(charArray, '²');
    const withoutPrefix2PositionsUpdated = positionByIndex_1(withoutPrefix2);

    const withDuplicatesAnd2 = [];
    {
        const input = withoutPrefix2PositionsUpdated;
        let position = 0;
        for (let i = 0; i < input.length; ++i) {
            if (input[i].char === '²') {
                const {char} = withDuplicatesAnd2[withDuplicatesAnd2.length - 1];
                withDuplicatesAnd2.push(new Char(Char.createKey(), char, position - 1));
            }
            withDuplicatesAnd2.push(new Char(input[i].key, input[i].char, position++));
        }
    }

    const withDuplicates = positionByIndex_1(withDuplicatesAnd2.filter(c => c.char !== '²'));

    return [withoutPrefix2, withoutPrefix2PositionsUpdated, withDuplicatesAnd2, withDuplicates];
}

function replace3_n(charArray) {
    const withoutPrefix3 = removePrefix_1(charArray, '³');
    const withoutPrefix3PositionsUpdated = positionByIndex_1(withoutPrefix3);

    const updatedPositions = Array(withoutPrefix3.length);
    {
        const input = withoutPrefix3PositionsUpdated;
        let position = 0;
        for (let i = 0; i < updatedPositions.length; ++i) {
            if (input[i].char === '³')
                ++position;
            updatedPositions[i] = new Char(input[i].key, input[i].char, position++);
        }
    }

    const duplicatesAdded = [];
    {
        const input = updatedPositions;
        for (let i = 0; i < input.length; ++i) {
            if (input[i].char === '³') {
                const {char} = duplicatesAdded[duplicatesAdded.length - 1];
                const position = input[i].position - 2;
                duplicatesAdded.push(new Char(Char.createKey(), char, position));
                duplicatesAdded.push(new Char(Char.createKey(), char, position));
            }
            duplicatesAdded.push(input[i]);
        }
    }

    const positionedAnd3Removed = positionByIndex_1(duplicatesAdded.filter(c => c.char !== '³'));

    return [withoutPrefix3, withoutPrefix3PositionsUpdated, updatedPositions, duplicatesAdded, positionedAnd3Removed];
}

function positionByIndex_1(charArray) {
    return charArray.map((c, idx) => c.position === idx ? c : new Char(c.key, c.char, idx));
}

function convertBlankSymbolsToSpace_n(charArray) {
    const blankReplacedBySpaces = charArray.map(c => c.char === '␣' ? new Char(c.key, ' ', c.position) : c);
    const leadingBlanksRemoved = positionByIndex_1(removePrefix_1(blankReplacedBySpaces, ' '));
    return [blankReplacedBySpaces, leadingBlanksRemoved];
}

function getSteps(charArray) {
    const last = array => array[array.length - 1];

    const charArrays = [charArray];
    charArrays.push(...removeGarbage_n(last(charArrays)));
    charArrays.push(...map32To33_n(last(charArrays)));
    charArrays.push(...map23To33_n(last(charArrays)));
    charArrays.push(...mergeDuplicates_n(last(charArrays)));
    charArrays.push(...removeDuplicates_n(last(charArrays)));
    charArrays.push(...replace2_n(last(charArrays)));
    charArrays.push(...replace3_n(last(charArrays)));
    charArrays.push(...convertBlankSymbolsToSpace_n(last(charArrays)));

    return charArrays;
}

async function animateExit(d3ExitSelection, duration) {
    if (d3ExitSelection.size() > 0) {
        await d3ExitSelection.transition()
            .duration(duration)
            .attr("opacity", 0.0)
            .end();
        d3ExitSelection.remove();
    }
}

async function animatePositionUpdate(d3PositionUpdateSelection, duration, positionX, positionY) {
    if (d3PositionUpdateSelection.size() > 0) {
        await d3PositionUpdateSelection
            .transition()
            .duration(duration)
            .attrs({
                x: positionX,
                y: positionY,
            })
            .end();
    }
}

async function animateTextUpdate(d3TextUpdateSelection, duration) {
    if (d3TextUpdateSelection.size() > 0) {
        await d3TextUpdateSelection
            .transition()
            .duration(duration / 2)
            .attr("opacity", 0.0)
            .end();
        d3TextUpdateSelection.text(d => d.char);
        await d3TextUpdateSelection
            .transition()
            .duration(duration / 2)
            .attr("opacity", 1.0)
            .end();
    }
}

async function animateEnter(d3EnterSelection, duration, positionX, positionY) {
    if (d3EnterSelection.size() > 0) {
        await d3EnterSelection
            .append("text")
            .attr("class", "letters")
            .attrs({
                x: positionX,
                y: positionY,
                opacity: 0.0,
            })
            .text(c => c.char)
            .transition()
            .duration(duration)
            .attr("opacity", 1.0)
            .end();
    }
}

async function animateStep(d3selection, duration, positionX, positionY, getPrevDataForNode) {
    const exitPromise = animateExit(d3selection.exit(), duration);

    const needsPositionUpdate = d3selection.filter((d, i, nodes) => d.position !== getPrevDataForNode(nodes[i]).position);
    const positionUpdatePromise = animatePositionUpdate(needsPositionUpdate, duration, positionX, positionY)

    const needsTextUpdate = d3selection.filter((d, i, nodes) => d.char !== getPrevDataForNode(nodes[i]).char);
    const textUpdatePromise = animateTextUpdate(needsTextUpdate, duration)

    const enterPromise = animateEnter(d3selection.enter(), duration, positionX, positionY);

    await exitPromise;
    await positionUpdatePromise;
    await textUpdatePromise;
    await enterPromise;
}

class Animator {
    constructor(d3select, charArrays, positionX, positionY) {
        this._d3select = d3select;
        this._charArrays = charArrays;
        this._positionX = positionX;
        this._positionY = positionY;
        this._current = 0;

        this._previousData = d3.local();
    }

    async _step(charArray, duration) {
        const d3selection = this._d3select()
            .each((d, i, nodes) => this._previousData.set(nodes[i], d))
            .data(charArray, c => c.key);

        await animateStep(d3selection, duration, this._positionX, this._positionY, node => this._previousData.get(node));
    }

    async next(stepDuration) {
        if (!this.isLast) {
            await this._step(this._charArrays[this.current + 1], stepDuration);
            this._current += 1;
        }
    }

    async prev(stepDuration) {
        if (!this.isFirst) {
            await this._step(this._charArrays[this.current - 1], stepDuration);
            this._current -= 1;
        }
    }

    async first(stepDuration) {
        while (!this.isFirst)
            await this.prev(stepDuration);
    }

    async last(stepDuration) {
        while (!this.isLast)
            await this.next(stepDuration);
    }

    get isFirst() {
        return this.current === 0;
    }

    get isLast() {
        return this.current === this.steps - 1;
    }

    get current() {
        return this._current;
    }

    get steps() {
        return this._charArrays.length;
    }
}

function visualizeResult(charArray, cellWidth, fontSizePx) {
    const margin = {top: 1, right: cellWidth, bottom: 1, left: cellWidth},
        width = charArray.length * cellWidth,
        height = fontSizePx,
        totalWidth = width + margin.left + margin.right,
        totalHeight = height + margin.top + margin.bottom;

    const svg = d3.create('svg')
        .attr("class", "result-viz")
        .attr("width", totalWidth)
        .attr("height", totalHeight);

    const diagram = svg.append("g")
        .attr("transform", `translate(${cellWidth},1)`);

    const lineHeight = fontSizePx;
    const charWidth = width / charArray.length;

    const d3select = () => diagram.selectAll("text");
    const positionX = c => (c.position + 0.5) * charWidth;
    const positionY = c => (1 - 0.175) * lineHeight;

    d3select()
        .data(charArray, c => c.key)
        .enter()
        .append("text")
        .attr("class", "letters")
        .attrs({
            x: positionX,
            y: positionY,
            opacity: 1.0,
        })
        .text(c => c.char);

    return {
        element: svg.node(),
        animator: new Animator(d3select, getSteps(charArray), positionX, positionY),
    };
}

class TextTransformationVisualizer {
    constructor(domElement, options) {
        this._parent = domElement;
        this._container = document.createElement('div');
        this._parent.append(this._container);
        this._animator = null;

        const defaultOptions = {
            cellWidth: 11,
            fontSize: 16,
        };
        this._options = Object.assign(defaultOptions, options);
    }

    setText(string) {
        const charArray = convertStringToCharArray(string);
        this.clear();
        const {animator, element} = visualizeResult(charArray, this._options.cellWidth, this._options.fontSize);
        this._container.append(element);
        this._animator = animator;
    }

    async autoplay() {
        if (this._animator !== null)
            await this._animator.last(1000);
    }

    async goToFirst(animate) {
        if (this._animator !== null)
            await this._animator.first(animate ? 1000 : 0);
    }

    async goToLast(animate) {
        if (this._animator !== null)
            await this._animator.last(animate ? 1000 : 0);
    }

    setRaw(indices, alphabet) {
        this.setText(convertRawToString(indices, alphabet));
    }

    clear() {
        $(this._container).empty();
        this._animator = null;
    }
}

module.exports = TextTransformationVisualizer;
