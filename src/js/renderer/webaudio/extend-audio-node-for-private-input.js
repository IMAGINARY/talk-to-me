/***
 * For your JS based audio nodes with dedicated inputs, include this file and add a _hasPrivateInputNode property set
 * to true and a private _input AudioNode field that will be used to connect to.
 */

// based on https://github.com/GoogleChromeLabs/web-audio-samples/wiki/CompositeAudioNode
AudioNode.prototype._connect_privateInputNodeExtension = AudioNode.prototype.connect;
AudioNode.prototype.connect = function () {
    const args = Array.prototype.slice.call(arguments);
    if (args[0]._hasPrivateInputNode)
        args[0] = args[0]._input;

    this._connect_privateInputNodeExtension.apply(this, args);
};
