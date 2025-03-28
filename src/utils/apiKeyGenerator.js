/**
 * Generates a secure API key
 * @returns {string} A secure API key
 */
export const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const keyLength = 32;
    let key = '';
    
    // Generate a random key
    for (let i = 0; i < keyLength; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        key += chars[randomIndex];
    }
    
    // Add a prefix to identify the key type
    const prefix = 'sk_';
    
    return prefix + key;
}; 