function isPackaged() {
    try {
        const electron = require("electron");
        return electron.remote ? electron.remote.app.isPackaged : electron.app.isPackaged;
    } catch (err) {
        return false;
    }
}

const storedIsPackaged = isPackaged();

module.exports = () => storedIsPackaged;
