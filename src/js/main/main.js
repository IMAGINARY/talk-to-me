const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const WavDecoder = require("wav-decoder");
const wav2letter = require("../common/wav2letter/wav2letter.js");

async function transcribeWavFile(path, lang) {
    const buffer = await fs.readFile(path);
    const audioData = await WavDecoder.decode(buffer);

    assert(audioData.numberOfChannels > 0, "Input file has no audio channel.");
    assert(audioData.sampleRate === 16000, "Input file has sample rate other than 16kHz.");

    return await wav2letter.transcribe({waveform: audioData.channelData[0], lang: lang});
}

async function main() {
    console.log(await transcribeWavFile(path.resolve(__dirname, '../../../audio/helloiamai_16kHz_16bit.wav'), "en"));
    console.log(await transcribeWavFile(path.resolve(__dirname, '../../../audio/helloiamai_16kHz_16bit.wav'), "en"));
    console.log(await transcribeWavFile(path.resolve(__dirname, '../../../audio/halloichbinki_16kHz_16bit.wav'), "de"));
}

main().then( async () => await wav2letter.shutdown());
