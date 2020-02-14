async function loadAudioFile(audioContext, url) {
    const request = new Request(url);
    const response = await fetch(request);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
}

module.exports = loadAudioFile;
