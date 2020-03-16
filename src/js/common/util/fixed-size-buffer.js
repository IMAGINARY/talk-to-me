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
        this._buffer = new dtypes[this._dtype](maxLength);
        this._count = 0;
    }

    static wrapArray(array) {
        const arrayType = Object.prototype.toString.call(array).match(/\[object (.*)]/)[1];
        const dtype = dtypes_inv[arrayType];
        if (typeof dtype === "undefined")
            throw new TypeError("FixedSizeBuffer can not be build from this object");
        const result = new FixedSizeBuffer(dtype, 0);
        result._buffer = array;
        return result;
    }

    push(data) {
        const newData = data.subarray(0, this._buffer.length - this._count);
        const overflow = data.subarray(this._buffer.length - this._count);
        if (newData.length > 0) {
            const start = this.length;
            const end = this.length + newData.length;
            this._buffer.set(newData, start);
            this.length = end;
            this.postData(start, end);
        }
        return overflow;
    }

    postData(start, end) {
        this.emit('data_changed', this._buffer.subarray(start, end), start, end);
    }

    clear() {
        this.length = 0;
    }

    get data() {
        return this._buffer.subarray(0, this._count);
    }

    get buffer() {
        return this._buffer;
    }

    get length() {
        return this._count;
    }

    set length(newLength) {
        newLength = Math.max(0, Math.min(newLength, this.maxLength));
        if (newLength !== this._count) {
            const prevCount = this._count;
            this._count = newLength;
            this.emit('length_changed', this.data, this.length, prevCount);
            switch (newLength) {
                case 0:
                    this.emit('empty');
                    break;
                case this.maxLength:
                    this.emit('full', this._buffer);
            }
        }
    }

    get maxLength() {
        return this._buffer.length;
    }

    get dtype() {
        return this._dtype;
    }
}

module.exports = FixedSizeBuffer;
