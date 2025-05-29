const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");

/**
 * Safely parse float values
 * @param {any} value - Value to parse
 * @returns {number|undefined} - Parsed float or undefined
 */
function parseFloatSafe(value) {
  if (value === undefined || value === null) return undefined;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and then parse
    const cleanStr = value.replace(/[^\d.-]/g, ''); // Keeps digits, decimal, and minus sign
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  return undefined;
}

/**
 * Safely parse integer values
 * @param {any} value - Value to parse
 * @returns {number|undefined} - Parsed integer or undefined
 */
function parseIntSafe(value) {
  if (value === undefined || value === null) return undefined;
  
  if (typeof value === 'number') return Math.round(value); // Round if it's already a number (e.g., float)
  
  if (typeof value === 'string') {
    const cleanStr = value.replace(/[^\d.-]/g, '');
    const parsed = parseInt(cleanStr, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  return undefined;
}

/**
 * Standardize units of measure
 * @param {string} unit - Raw unit of measure from CSV
 * @returns {string} - Standardized unit
 */
function standardizeUOM(unit) {
  if (!unit) return 'LBS'; // Default to pounds if missing
  
  // Convert to uppercase for easier comparison
  const normalizedUnit = unit.toUpperCase().trim();
  
  // Weight units standardization
  // Pounds
  if (['L', 'LB', 'LBS', 'POUND', 'POUNDS', '#', 'P'].includes(normalizedUnit)) {
    return 'LBS';
  }
  
  // Kilograms
  if (['K', 'KG', 'KGS', 'KILO', 'KILOS', 'KILOGRAM', 'KILOGRAMS'].includes(normalizedUnit)) {
    return 'KGS';
  }
  
  // Ounces
  if (['OZ', 'OUNCE', 'OUNCES'].includes(normalizedUnit)) {
    return 'OZ';
  }
  
  // Dimensions units standardization
  if (['IN', 'INCH', 'INCHES', '"', 'I'].includes(normalizedUnit)) { // Added 'I' for Inches
    return 'IN';
  }
  
  if (['CM', 'CENTIMETER', 'CENTIMETERS'].includes(normalizedUnit)) {
    return 'CM';
  }
  
  if (['M', 'METER', 'METERS'].includes(normalizedUnit)) {
    return 'M';
  }
  
  // Return the original if not recognized
  return unit;
}

/**
 * Sets a value in a nested object using a dot-notation path.
 * Example: setByPath(obj, 'a.b.c', 10) will set obj.a.b.c = 10
 * @param {object} obj - The object to modify.
 * @param {string} path - The dot-notation path string.
 * @param {any} value - The value to set.
 */
function setByPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Get carrier credentials from Firestore
 * @param {string} carrierID - The carrier ID or name (e.g., 'ESHIPPLUS', 'Canpar', 'Canpar Express')
 * @returns {Promise<object|null>} - Carrier credentials or null if not found
 */
async function getCarrierCredentials(carrierID) {
  try {
    logger.info(`Fetching credentials for carrier: ${carrierID}`);
    
    const carriersRef = db.collection('carriers');
    
    // First try to find by carrierID
    let snapshot = await carriersRef
      .where('carrierID', '==', carrierID)
      .where('enabled', '==', true)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    // If not found by carrierID, try searching by name
    if (snapshot.empty) {
      logger.info(`No carrier found with carrierID '${carrierID}', trying name search...`);
      snapshot = await carriersRef
        .where('name', '==', carrierID)
        .where('enabled', '==', true)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    }
    
    // If still not found, try case-insensitive search for name
    if (snapshot.empty) {
      logger.info(`No carrier found with exact name '${carrierID}', trying case-insensitive search...`);
      const allCarriers = await carriersRef
        .where('enabled', '==', true)
        .where('status', '==', 'active')
        .get();
      
      const matchingCarrier = allCarriers.docs.find(doc => {
        const data = doc.data();
        const name = data.name || '';
        const id = data.carrierID || '';
        return name.toLowerCase() === carrierID.toLowerCase() || 
               id.toLowerCase() === carrierID.toLowerCase();
      });
      
      if (matchingCarrier) {
        snapshot = { docs: [matchingCarrier], empty: false };
      }
    }
    
    if (snapshot.empty) {
      logger.warn(`No active carrier found with ID or name: ${carrierID}`);
      return null;
    }
    
    const carrierDoc = snapshot.docs[0];
    const carrierData = carrierDoc.data();
    
    // Log the full carrier data structure for debugging
    logger.info(`Full carrier data structure for ${carrierID}:`, JSON.stringify(carrierData, null, 2));
    
    if (!carrierData.apiCredentials) {
      logger.warn(`Carrier ${carrierID} found but has no apiCredentials`);
      return null;
    }
    
    // Check for endpoints - they can be in apiCredentials.endpoints, root level, or other locations
    const endpoints = carrierData.apiCredentials.endpoints || 
                     carrierData.apiEndpoints || 
                     carrierData.endpoints || 
                     carrierData.apiCredentials.apiEndpoints || 
                     null;
                     
    if (!endpoints) {
      logger.warn(`Carrier ${carrierID} found but has no endpoints configuration. Available apiCredentials fields:`, Object.keys(carrierData.apiCredentials));
      logger.warn(`Available root fields:`, Object.keys(carrierData));
    }
    
    logger.info(`Successfully retrieved credentials for carrier: ${carrierID} (found as: ${carrierData.name || carrierData.carrierID})`);
    logger.info(`Endpoints found:`, endpoints ? Object.keys(endpoints) : 'No endpoints');
    
    return {
      ...carrierData.apiCredentials,
      endpoints: endpoints, // Include endpoints in the credentials (may be null)
      hostURL: carrierData.apiCredentials.hostURL || carrierData.hostURL, // Check both locations for hostURL
      carrierName: carrierData.name,
      carrierType: carrierData.type,
      carrierID: carrierData.carrierID
    };
  } catch (error) {
    logger.error(`Error fetching carrier credentials for ${carrierID}:`, error);
    return null;
  }
}

/**
 * Determine which carrier to use based on shipment type
 * @param {string} shipmentType - 'freight' or 'courier'
 * @returns {string} - Carrier ID to use
 */
function getCarrierForShipmentType(shipmentType) {
  // Map shipment types to carrier IDs
  const carrierMapping = {
    'freight': 'ESHIPPLUS',
    'courier': 'FEDEX' // You can add other courier carriers here
  };
  
  return carrierMapping[shipmentType] || 'ESHIPPLUS'; // Default to ESHIPPLUS
}

/**
 * Get eShipPlus authentication header from carrier credentials
 * @param {object} credentials - Carrier credentials object
 * @returns {string} - Base64 encoded auth header
 */
function createEShipPlusAuthHeader(credentials) {
  const authPayload = {
    UserName: credentials.username,
    Password: credentials.password,
    AccessKey: credentials.secret,
    AccessCode: credentials.accountNumber
  };
  return Buffer.from(JSON.stringify(authPayload)).toString('base64');
}

/**
 * Build full API URL for a carrier endpoint
 * @param {object} credentials - Carrier credentials with hostURL and endpoints
 * @param {string} endpoint - Endpoint type ('rate', 'booking', 'tracking', etc.)
 * @returns {string} - Complete API URL
 */
function buildCarrierApiUrl(credentials, endpoint) {
  if (!credentials.endpoints) {
    logger.error(`No endpoints configuration found in carrier credentials for endpoint '${endpoint}'. Credentials structure:`, Object.keys(credentials));
    throw new Error(`No endpoints configuration found in carrier credentials. Available credential fields: ${Object.keys(credentials).join(', ')}`);
  }
  
  const endpointPath = credentials.endpoints[endpoint];
  if (!endpointPath) {
    logger.error(`No ${endpoint} endpoint configured for this carrier. Available endpoints:`, Object.keys(credentials.endpoints));
    throw new Error(`No ${endpoint} endpoint configured for this carrier. Available endpoints: ${Object.keys(credentials.endpoints).join(', ')}`);
  }
  
  // If endpoint is already a full URL (starts with http), return it as-is
  if (endpointPath.startsWith('http://') || endpointPath.startsWith('https://')) {
    return endpointPath;
  }
  
  // Otherwise, combine with hostURL
  // Ensure hostURL ends with '/' and endpointPath doesn't start with '/'
  const baseUrl = credentials.hostURL.endsWith('/') ? credentials.hostURL : `${credentials.hostURL}/`;
  const path = endpointPath.startsWith('/') ? endpointPath.substring(1) : endpointPath;
  
  return `${baseUrl}${path}`;
}

/**
 * Get carrier API configuration including URLs
 * @param {string} carrierID - The carrier ID (e.g., 'ESHIPPLUS')
 * @param {string} endpoint - The endpoint type ('rate', 'booking', etc.)
 * @returns {Promise<object>} - Carrier config with URLs and credentials
 */
async function getCarrierApiConfig(carrierID, endpoint) {
  try {
    logger.info(`Fetching API config for carrier: ${carrierID}, endpoint: ${endpoint}`);
    
    const credentials = await getCarrierCredentials(carrierID);
    if (!credentials) {
      throw new Error(`Carrier credentials not found for: ${carrierID}`);
    }
    
    const apiUrl = buildCarrierApiUrl(credentials, endpoint);
    
    logger.info(`Built API URL for ${carrierID}/${endpoint}: ${apiUrl}`);
    
    return {
      apiUrl,
      credentials,
      carrierID,
      endpoint
    };
  } catch (error) {
    logger.error(`Error getting carrier API config for ${carrierID}/${endpoint}:`, error);
    throw error;
  }
}

/**
 * Validate that a carrier has all required endpoints
 * @param {object} credentials - Carrier credentials
 * @param {string[]} requiredEndpoints - Array of required endpoint names
 * @returns {boolean} - True if all endpoints are present
 */
function validateCarrierEndpoints(credentials, requiredEndpoints = ['rate', 'booking']) {
  if (!credentials.endpoints) {
    return false;
  }
  
  return requiredEndpoints.every(endpoint => 
    credentials.endpoints[endpoint] && 
    typeof credentials.endpoints[endpoint] === 'string'
  );
}

/**
 * Get all available endpoints for a carrier
 * @param {string} carrierID - The carrier ID
 * @returns {Promise<string[]>} - Array of available endpoint names
 */
async function getCarrierEndpoints(carrierID) {
  try {
    const credentials = await getCarrierCredentials(carrierID);
    if (!credentials || !credentials.endpoints) {
      return [];
    }
    
    return Object.keys(credentials.endpoints);
  } catch (error) {
    logger.error(`Error getting endpoints for carrier ${carrierID}:`, error);
    return [];
  }
}

/**
 * Sanitize postal code by removing spaces (required for Canpar API)
 * @param {string} postalCode - Raw postal code
 * @returns {string} - Sanitized postal code without spaces
 */
function sanitizePostalCode(postalCode) {
  if (!postalCode) return '';
  return postalCode.replace(/\s+/g, '');
}

const db = admin.firestore(admin.app(), 'admin');

module.exports = {
    parseFloatSafe,
    parseIntSafe,
    standardizeUOM,
    setByPath,
    getCarrierCredentials,
    getCarrierForShipmentType,
    createEShipPlusAuthHeader,
    buildCarrierApiUrl,
    getCarrierApiConfig,
    validateCarrierEndpoints,
    getCarrierEndpoints,
    sanitizePostalCode,
    db
}; 