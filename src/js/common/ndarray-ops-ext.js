const cwise = require("cwise");

function _logit(p) {
    return Math.log(p / (1 - p));
}

function _sigmoid(L) {
    const expL = Math.exp(L);
    return expL / (1 + expL);
}

const logiteq = cwise({
    args: ["array"],
    body: function (a) {
        a = _logit(a);
    }
});

const logit = cwise({
    args: ["array", "array"],
    body: function (a, b) {
        a = _logit(b);
    }
});

const sigmoideq = cwise({
    args: ["array"],
    body: function (a) {
        const expL = Math.exp(a);
        a = expL / (1 + expL);
    }
});

const sigmoid = cwise({
    args: ["array", "array"],
    body: function (a, b) {
        const expL = Math.exp(b);
        a = expL / (1 + expL);
    }
});

module.exports = {
    logit: logit,
    logiteq: logiteq,
    sigmoid: sigmoid,
    sigmoideq: sigmoideq,
};
