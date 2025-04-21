/**
 * Generates a random API key with specified length
 * @param {number} length - Length of the API key to generate
 * @returns {string} - The generated API key
 */
export const generateApiKey = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  
  randomValues.forEach(val => {
    result += chars.charAt(val % chars.length);
  });
  
  return result;
}; 