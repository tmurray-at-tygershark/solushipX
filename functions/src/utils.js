const admin = require('firebase-admin');

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

const db = admin.firestore(admin.app(), 'admin');

module.exports = {
    parseFloatSafe,
    parseIntSafe,
    standardizeUOM,
    setByPath,
    db
}; 