const { getRatesEShipPlus } = require('./getRates');
const { bookRateEShipPlus, bookEShipPlusShipment } = require('./bookRate');
const { getStatusEShipPlus } = require('./getStatus');
const { fetchAndTransformEShipPlusHistory } = require('./getHistory');
const { cancelEShipPlusShipment, processCancelRequest, cancelShipmentEShipPlus } = require('./cancelShipment');
// Note: generateEShipPlusBOL removed - using Generic BOL generation instead for consistency

module.exports = {
    getRatesEShipPlus,
    bookRateEShipPlus,
    bookEShipPlusShipment,
    getStatusEShipPlus,
    fetchAndTransformEShipPlusHistory,
    cancelEShipPlusShipment,
    processCancelRequest,
    cancelShipmentEShipPlus,
    // generateEShipPlusBOL removed - using Generic BOL generation instead
}; 