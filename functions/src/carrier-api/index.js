const eshipplusFunctions = require('./eshipplus');
const canparFunctions = require('./canpar');
const polaristransportationFunctions = require('./polaristransportation');
 
module.exports = {
    ...eshipplusFunctions,
    ...canparFunctions,
    ...polaristransportationFunctions,
    // ... add other carriers here
}; 