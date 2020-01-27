module.exports = {
    toLowerCase: s => s.replace(/ẞ/g, 'ß').toLowerCase(),
    toUpperCase: s => s.replace(/ß/g, 'ẞ').toUpperCase(),
};
