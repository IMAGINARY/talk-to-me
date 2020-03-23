const assert = require('assert');
const $ = require('jquery');
const Hammer = require('hammerjs');
const d3 = require('d3');
require('d3-selection-multi');
require('d3-transition');

const last = array => array[array.length - 1];
const last2 = array => last(last(array));

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

    equals(otherChar) {
        return this.key === otherChar.key
            && this.char === otherChar.char
            && this.position === otherChar.position;
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

function removeDuplicates_n(charArray) {
    const duplicatesMerged = [...charArray];
    for (let i = 1; i < duplicatesMerged.length; ++i) {
        if (duplicatesMerged[i - 1].char === duplicatesMerged[i].char)
            duplicatesMerged[i] = new Char(duplicatesMerged[i].key, duplicatesMerged[i].char, duplicatesMerged[i - 1].position);
    }

    const duplicatesRemoved = charArray.filter((c, idx) => idx === 0 || c.char !== charArray[idx - 1].char);
    const positionsUpdated = duplicatesRemoved.map((c, idx) => c.position === idx ? c : new Char(c.key, c.char, idx));
    return [duplicatesMerged, duplicatesRemoved, positionsUpdated];
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

function charArraysEqual(a, b) {
    if (a.length === b.length) {
        for (let i = 0; i < a.length; ++i) {
            if (!a[i].equals(b[i]))
                return false;
        }
        return true;
    } else {
        return false;
    }
}

function cleanUpSteps(bigSteps) {
    // Condense small steps that do not change anything
    const allSmallStepsCleaned = [];
    for (let smallSteps of bigSteps) {
        if (smallSteps.length > 0) {
            const smallStepsCleaned = [smallSteps[0]];
            for (let i = 1; i < smallSteps.length; ++i)
                if (!charArraysEqual(last(smallStepsCleaned), smallSteps[i]))
                    smallStepsCleaned.push(smallSteps[i]);
            allSmallStepsCleaned.push(smallStepsCleaned);
        }
    }

    // A big step that consists of only one small step that doesn't differ from the previous big step's last small step
    // can be safely removed.
    const bigStepsCleaned = [allSmallStepsCleaned[0]];
    for (let i = 1; i < allSmallStepsCleaned.length; ++i) {
        if (!(allSmallStepsCleaned[i].length === 1 && charArraysEqual(last(allSmallStepsCleaned[i - 1]), allSmallStepsCleaned[i][0])))
            bigStepsCleaned.push(allSmallStepsCleaned[i]);
    }
    return bigStepsCleaned;
}

// In this version, duplicate letter are detected by utilizing the blank symbol.
function getSteps_DuplicatesThroughBlanks(charArray) {
    const charArrays = [[charArray]];
    charArrays.push(removeDuplicates_n(last2(charArrays)));
    charArrays.push(removeGarbage_n(last2(charArrays)));
    charArrays.push(convertBlankSymbolsToSpace_n(last2(charArrays)));

    return cleanUpSteps(charArrays);
}

// In this version, duplicate letters are detected through the ² and ³ control symbols.
function getSteps_DuplicatesThrough23(charArray) {
    const charArrays = [[charArray]];
    charArrays.push(removeGarbage_n(last2(charArrays)));
    charArrays.push(map32To33_n(last2(charArrays)));
    charArrays.push(map23To33_n(last2(charArrays)));
    charArrays.push(removeDuplicates_n(last2(charArrays)));
    charArrays.push(replace2_n(last2(charArrays)));
    charArrays.push(replace3_n(last2(charArrays)));
    charArrays.push(convertBlankSymbolsToSpace_n(last2(charArrays)));

    return cleanUpSteps(charArrays);
}

function getSteps(charArray) {
    // the decoding method used needs to be in line with how the model detects duplicate characters
    // getSteps_DuplicatesThrough23(charArray);
    return getSteps_DuplicatesThroughBlanks(charArray);
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
    const positionUpdatePromise = animatePositionUpdate(needsPositionUpdate, duration, positionX, positionY);

    const needsTextUpdate = d3selection.filter((d, i, nodes) => d.char !== getPrevDataForNode(nodes[i]).char);
    const textUpdatePromise = animateTextUpdate(needsTextUpdate, duration);

    const enterPromise = animateEnter(d3selection.enter(), duration, positionX, positionY);

    await exitPromise;
    await positionUpdatePromise;
    await textUpdatePromise;
    await enterPromise;
}

class Animator {
    constructor(d3select, charArrays, positionX, positionY, prevButton, nextButton) {
        assert(charArrays.length !== 0);
        assert(charArrays[0].length === 1, "First set of states must only contain the single initial state.");

        this._d3select = d3select;
        this._charArrays = charArrays;
        this._positionX = positionX;
        this._positionY = positionY;
        this._prevButton = prevButton;
        this._nextButton = nextButton;
        this._current = 0;
        this._target = 0;

        this._prevButtonHammer = new Hammer(this._prevButton.node());
        this._prevButtonHammer.on('tap', () => this.prev());
        this._nextButtonHammer = new Hammer(this._nextButton.node());
        this._nextButtonHammer.on('tap', () => this.next());

        this._previousData = d3.local();

        this.defaultDuration = 0;
        this._duration = 0;
        this._animating = false;
        this._animationPromise = Promise.resolve();
    }

    async _step_n_forward(charArrays, duration) {
        for (let charArray of charArrays)
            await this._step_1(charArray, duration);
    }

    async _step_n_backward(charArrays, duration) {
        for (let i = charArrays.length - 1; i >= 0; --i)
            await this._step_1(charArrays[i], duration);
    }

    async _step_1(charArray, duration) {
        if (typeof duration === "undefined")
            duration = 0;
        const d3selection = this._d3select()
            .each((d, i, nodes) => this._previousData.set(nodes[i], d))
            .data(charArray, c => c.key);

        await animateStep(d3selection, duration, this._positionX, this._positionY, node => this._previousData.get(node));
    }

    async next(stepDuration) {
        this.goTo(this._target + 1, stepDuration);
    }

    async prev(stepDuration) {
        this.goTo(this._target - 1, stepDuration);
    }

    showButtons() {
        this._prevButton.style('visibility', 'visible');
        this._nextButton.style('visibility', 'visible');
    }

    hideButtons() {
        this._prevButton.style('visibility', 'hidden');
        this._nextButton.style('visibility', 'hidden');
    }

    async _moveOneBigStepTowardsTarget() {
        if (this._current < this._target) {
            // step forward
            this._current += 1;
            await this._step_n_forward(this._charArrays[this.current], this._duration);
        } else if (this._current > this._target) {
            // step backward
            this._current -= 1;
            await this._step_n_backward(this._charArrays[this.current + 1], this._duration);
            await this._step_1(last(this._charArrays[this.current]), this._duration);
        } else {
            // current === target, do nothing
        }
        // (de-)activate nav buttons
        this._prevButton.classed("disabled", this._current === 0);
        this._prevButtonHammer.get('tap').set({enable: !(this._current === 0)});
        this._nextButton.classed("disabled", this._current === this.steps - 1);
        this._nextButtonHammer.get('tap').set({enable: !(this._current === this.steps - 1)});
    }

    async _moveTowardsTarget() {
        while (this._current !== this._target)
            await this._moveOneBigStepTowardsTarget();
    }

    async goTo(target, stepDuration) {
        this._target = Math.min(Math.max(0, target), this.steps - 1);
        this._duration = typeof stepDuration === "undefined" ? this.defaultDuration : stepDuration;
        if (!this._animating) {
            this._animating = true;
            this._animationPromise = this._moveTowardsTarget();
            await this._animationPromise;
            this._animating = false;
        } else {
            this.wait();
        }
    }

    async first(stepDuration) {
        await this.goTo(0, stepDuration);
    }

    async last(stepDuration) {
        await this.goTo(this.steps - 1, stepDuration);
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

    get target() {
        return this._target;
    }

    get steps() {
        return this._charArrays.length;
    }

    get isAnimating() {
        return this._animating;
    }

    async wait() {
        await this._animationPromise;
    }
}

function visualizeResult(charArray, cellWidth, fontSizePx) {
    const margin = {top: 1, right: cellWidth, bottom: 1, left: cellWidth},
        width = charArray.length * cellWidth,
        height = fontSizePx,
        totalWidth = width + margin.left + margin.right,
        totalHeight = height + margin.top + margin.bottom;

    const svg = d3.create('svg')
        .attr("class", "text-transformation-viz")
        .attr("width", totalWidth)
        .attr("height", totalHeight);

    const diagram = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    const letters = diagram.append("g")
        .attr("class", "monospaced");

    const lineHeight = fontSizePx;

    const d3select = () => letters.selectAll("text");
    const positionX = c => (c.position + 0.5) * cellWidth;
    const positionY = _ => (1 - 0.175) * lineHeight;

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

    const navButtons = diagram.append("g");
    const prevButton = navButtons.append("g");
    prevButton.append("text")
        .attr("class", "button prev fa")
        .attrs({
            x: positionX({position: -1.5}),
            y: 0.53 * lineHeight,
        })
        .text("\uf104");
    prevButton.append("rect")
        .attrs({
            x: positionX({position: -1.5}),
            y: 0,
            width: 2 * cellWidth,
            height: lineHeight,
            fill: "transparent",
        });
    const nextButton = navButtons.append("g");
    nextButton.append("text")
        .attr("class", "button next fa")
        .attrs({
            x: positionX({position: charArray.length + 0.5}),
            y: 0.53 * lineHeight,
        })
        .text("\uf105");
    prevButton.append("rect")
        .attrs({
            x: positionX({position: charArray.length - 1.5}),
            y: 0,
            width: 2 * cellWidth,
            height: lineHeight,
            fill: "transparent",
        });

    return {
        element: svg.node(),
        animator: new Animator(d3select, getSteps(charArray), positionX, positionY, prevButton, nextButton),
    };
}

class TextTransformationVisualizer {
    constructor(domElement, options) {
        this._parent = domElement;
        this._container = document.createElement('div');
        this._parent.append(this._container);

        const defaultOptions = {
            cellWidth: 11,
            fontSize: 16,
            animationDuration: 1000,
        };
        this._options = Object.assign(defaultOptions, options);

        this.setText("");
    }

    setText(string) {
        const charArray = convertStringToCharArray(string);
        this.clear();
        const {animator, element} = visualizeResult(charArray, this._options.cellWidth, this._options.fontSize);
        this._container.append(element);
        this._animator = animator;
        this._animator.defaultDuration = this._options.animationDuration;
        return animator;
    }

    get animator() {
        return this._animator;
    }

    setRaw(indices, alphabet) {
        this.setText(convertRawToString(indices, alphabet));
    }

    clear() {
        $(this._container).empty();
    }
}

module.exports = TextTransformationVisualizer;
