const { getCanparRates } = require("./getRates");
const { bookCanparShipment } = require("./bookRate");
const { getHistoryCanpar } = require("./getHistory");

module.exports = {
    getCanparRates,
    bookCanparShipment,
    getHistoryCanpar
};