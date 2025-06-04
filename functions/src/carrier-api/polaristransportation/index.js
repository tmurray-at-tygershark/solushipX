// Re-export the Firebase Cloud Functions directly
const { getRatesPolarisTransportation } = require('./getRates');
const { bookPolarisTransportationShipment } = require('./bookRate');
const { getStatusPolarisTransportation } = require('./getStatus');
const { getHistoryPolarisTransportation } = require('./getHistory');

module.exports = {
    getRatesPolarisTransportation,
    bookPolarisTransportationShipment,
    getStatusPolarisTransportation,
    getHistoryPolarisTransportation,
}; 