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
        transcribeSync(models[lang], new Float32Array(0));
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
        return normalizedLogMel;
    } else {
        return logMel;
    }
}

function w2l_forward(audio, model, data_format, return_all = false) {
    if (data_format === "channels_last")
        audio = tf.transpose(audio, [0, 2, 1]);

    const out = model.predict(audio);
    if (return_all)
        return out;
    else
        return out[out.length - 1];
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

function transcriptionFromActivations(activations, letters) {
    const maxActivationIndices = tf.argMax(activations.squeeze(0), 1).arraySync();
    const transcription = maxActivationIndices.map(i => letters[i]).join("").replace(/ +/, " ");
    return transcription;
}

function transcribeSync(model, waveform16kHzFloat32) {
    const windowSize = 400;
    if (waveform16kHzFloat32.length < windowSize) {
        const paddedWaveform = new Float32Array(windowSize);
        paddedWaveform.set(waveform16kHzFloat32);
        waveform16kHzFloat32 = paddedWaveform;
    }

    const melSpectrogram = rawToMel(tf.tensor(waveform16kHzFloat32), 16000, windowSize, 160, 128, true);
    const allActivations = w2l_forward(tf.expandDims(melSpectrogram, 0), model.tfModel, 'channels_last', true);
    const transcription = transcriptionFromActivations(allActivations[11], model.letters);
    return transcription;
}

async function transcribe(params) {
    const model = await getModel(params.lang);
    const transcription = transcribeSync(model, params.waveform);
    return transcription;
}


module.exports = {transcribe: transcribe, unloadModel: unloadModel};
