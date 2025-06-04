const { getCanparRates } = require("./getRates");
const { bookCanparShipment } = require("./bookRate");
const { getHistoryCanpar } = require("./getHistory");
const { cancelCanparShipment, processCancelRequest, cancelShipmentCanpar } = require('./cancelShipment');

module.exports = {
    getCanparRates,
    bookCanparShipment,
    getHistoryCanpar,
    cancelCanparShipment,
    processCancelRequest,
    cancelShipmentCanpar,
};