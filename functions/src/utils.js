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


module.exports = {
    parseFloatSafe,
    parseIntSafe
}; 