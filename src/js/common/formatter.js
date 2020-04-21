function getElapsedTimeFormatter(locales) {
    const elapsedTimeFormatter = new Intl.NumberFormat(locales, {
        style: 'decimal',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });
    return elapsedTimeFormatter.format.bind(elapsedTimeFormatter);
}

function getTotalTimeFormatter(locales) {
    const totalTimeFormatter = new Intl.NumberFormat(locales, {
        style: 'decimal',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    return totalTimeFormatter.format.bind(totalTimeFormatter);
}

module.exports = {
    elapsedTime: getElapsedTimeFormatter,
    totalTime: getTotalTimeFormatter,
};
