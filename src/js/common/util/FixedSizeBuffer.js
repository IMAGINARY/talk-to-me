const EventEmitter = require('events');

const dtypes = {
    "int8": typeof Int8Array === "undefined" ? undefined : Int8Array,
    "int16": typeof Int16Array === "undefined" ? undefined : Int16Array,
    "int32": typeof Int32Array === "undefined" ? undefined : Int32Array,
    "uint8": typeof Uint8Array === "undefined" ? undefined : Uint8Array,
    "uint16": typeof Uint16Array === "undefined" ? undefined : Uint16Array,
    "uint32": typeof Uint32Array === "undefined" ? undefined : Uint32Array,
    "bigint64": typeof BigInt64Array === "undefined" ? undefined : BigInt64Array,
    "biguint64": typeof BigUint64Array === "undefined" ? undefined : BigUint64Array,
    "float32": typeof Float32Array === "undefined" ? undefined : Float32Array,
    "float64": typeof Float64Array === "undefined" ? undefined : Float64Array,
    "uint8_clamped": typeof Uint8ClampedArray === "undefined" ? undefined : Uint8ClampedArray,
};

const dtypes_inv = {
    "Int8Array": "int8",
    "Int16Array": "int16",
    "Int32Array": "int32",
    "Uint8Array": "uint8",
    "Uint16Array": "uint16",
    "Uint32Array": "uint32",
    "BigInt64Array": "bigint64",
    "BigUint64Array": "biguint64",
    "Float32Array": "float32",
    "Float64Array": "float64",
    "Uint8ClampedArray": "uint8_clamped",
};

class FixedSizeBuffer extends EventEmitter {
    constructor(dtype, maxLength) {
        super();
        this._dtype = dtype;
        this.buffer = new dtypes[this._dtype](maxLength);
        this.count = 0;
    }

    static wrapArray(array) {
        const arrayType = Object.prototype.toString.call(array).match(/\[object (.*)\]/)[1];
        const dtype = dtypes_inv[arrayType];
        if (typeof dtype === "undefined")
            throw new TypeError("FixedSizeBuffer can not be build from this object");
        const result = new FixedSizeBuffer(dtype, 0);
        result.buffer = array;
        return result;
    }

    push(data) {
        const newData = data.subarray(0, this.buffer.length - this.count);
        const overflow = data.subarray(this.buffer.length - this.count);
        if (newData.length > 0) {
            this.buffer.set(newData, this.count);
            const prevCount = this.count;
            this.count += newData.length;
            this.emit('data', this.buffer.subarray(prevCount, this.count), this.count, prevCount);
            if (this.count === this.buffer.length) {
                this.emit('full', this.buffer);
            }
        }
        return overflow;
    }

    clear() {
        this.count = 0;
        this.emit('empty');
    }

    get data() {
        return this.buffer.subarray(0, this.count);
    }

    get length() {
        return this.count;
    }

    get maxLength() {
        return this.buffer.length;
    }

    get dtype() {
        return this._dtype;
    }
}

module.exports = FixedSizeBuffer;
