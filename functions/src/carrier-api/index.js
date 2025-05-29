const eshipplusFunctions = require('./eshipplus');
const canparFunctions = require('./canpar');
 
module.exports = {
    ...eshipplusFunctions,
    ...canparFunctions,
    // ... add other carriers here
}; 