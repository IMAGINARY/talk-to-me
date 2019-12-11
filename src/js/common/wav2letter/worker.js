const assert = require('assert');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

const melFilter = require('./mel-filter.js');

const models = {
    "en": {
        url: 'file://' + path.resolve(__dirname, '../../../../models/english/model.json'),
        letters: '  abcdefghijklmnopqrstuvwxyz   ',
        tfModel: null,
    },
    "de": {
        url: 'file://' + path.resolve(__dirname, '../../../../models/german/model.json'),
        letters: '  abcdefghijklmnopqrstuvwxyzßäöü   ',
        tfModel: null,
    }
};

function assertLang(lang) {
    assert(typeof models[lang] !== 'undefined', "Only the following languages are supported at the moment: " + Object.keys(models).join(", "));
}

async function getModel(lang) {
    assertLang(lang);
    if (models[lang].tfModel === null) {
        models[lang].tfModel = await tf.loadLayersModel(models[lang].url);
        tf_predictExtSync(models[lang], new Float32Array(0));
        console.log(`Model for ${lang} loaded successfully.`);
    }
    return models[lang];
}

function unloadModel(lang) {
    assertLang(lang);
    if (models[lang].tfModel !== null) {
        models[lang].tfModel = null;
        console.log(`Model for ${lang} unloaded.`);
    } else {
        console.log(`Model for ${lang} not unloaded, because it was not loaded.`);
    }
}

function melspectrogram(S, sr, n_mels) {
    const n_fft = 2 * (S.shape[0] - 1);
    const mel_basis = melFilter(sr, n_fft, n_mels);
    return tf.dot(mel_basis, S);
}

function rawToMel(audio, sampling_rate, window_size, hop_length, n_freqs, normalize) {
    const spectro = tf.transpose(tf.signal.stft(audio, window_size, hop_length - 1, window_size, tf.signal.hannWindow));
    const power = tf.square(tf.abs(spectro));
    const mel = melspectrogram(power, sampling_rate, n_freqs);

    //exportTensor2D("spectro.txt", spectro);
    //exportTensor2D("power.txt", power);
    //exportTensor2D("mel.txt", mel);

    const logMel = tf.log(mel.add(tf.scalar(1e-11)));
    //exportTensor2D("logMel.txt", logMel);
    if (normalize) {
        const mean = tf.mean(logMel);
        //exportTensor2D("mean.txt", spectro);
        const stdDev = tf.sqrt(tf.sum(tf.squaredDifference(logMel, mean)).div(logMel.shape[0] * logMel.shape[1]));
        //exportTensor2D("stdDev.txt", spectro);
        const normalizedLogMel = logMel.sub(mean).div(stdDev);
        return normalizedLogMel.transpose();
    } else {
        return logMel.transpose();
    }
}

function exportTensor2D(filename, t) {
    fs.open(filename, 'w', async (err, fd) => {
        if (err)
            throw err;

        const data = t.dataSync();
        let i = 0;
        for (let j = 0; j < t.shape[0]; ++j) {
            for (let k = 0; k < t.shape[1]; ++k) {
                const s = data[i++] + (k === t.shape[1] - 1 ? "" : " ");
                fs.writeSync(fd, s);
            }
            fs.writeSync(fd, "\n");
        }
        fs.fdatasyncSync(fd);
        fs.closeSync(fd);
    });
}

function tf_decodeGreedy(letterActivations, letters) {
    const maxActivationIndices = tf.argMax(letterActivations, 1).arraySync();
    const transcription = maxActivationIndices.map(i => letters[i]).join("").replace(/ +/, " ");
    return transcription;
}

function ensureWaveformLength(waveform, targetLength) {
    if (waveform.length < targetLength) {
        const paddedWaveform = new Float32Array(targetLength);
        paddedWaveform.set(waveform);
        return paddedWaveform;
    } else {
        return waveform;
    }
}

async function transcribe(params) {
    const prediction = await tf_predictExt(params);
    const letterActivations = prediction.layers[prediction.layers.length - 1];
    const transcription = tf_decodeGreedy(letterActivations, prediction.letters);
    return transcription;
}

function tf_predictExtSync(model, waveform16kHzFloat32) {
    const windowSize = 400;
    waveform16kHzFloat32 = ensureWaveformLength(waveform16kHzFloat32, windowSize);

    const logMelSpectrogram = rawToMel(tf.tensor(waveform16kHzFloat32), 16000, windowSize, 160, 128, true);

    const allActivations = model.tfModel
        .predict(tf.expandDims(logMelSpectrogram, 0))
        .map(layer => layer.squeeze(0));

    return {
        logMelSpectrogram: logMelSpectrogram,
        layers: allActivations,
        letters: model.letters
    }
}

async function tf_predictExt(params) {
    const model = await getModel(params.lang);
    const prediction = tf_predictExtSync(model, params.waveform);
    return prediction;
}

async function predictExt(params) {
    const tfPrediction = await tf_predictExt(params);
    return {
        logMelSpectrogram: await tensorToShapedTypedArray(tfPrediction.logMelSpectrogram),
        layers: await Promise.all(tfPrediction.layers.map(tensorToShapedTypedArray)),
        letters: tfPrediction.letters,
    }
}

async function predict(params) {
    const tfPrediction = await tf_predictExt(params);
    return {
        letterActivations: await tensorToShapedTypedArray(tfPrediction.layers[tfPrediction.layers.length - 1]),
        letters: tfPrediction.letters
    }
}

async function tensorToShapedTypedArray(tensor) {
    return {
        data: await tensor.data(),
        shape: tensor.shape,
    }
}

module.exports = {
    transcribe: transcribe,
    predict: predict,
    predictExt: predictExt,
    unloadModel: unloadModel,
};
