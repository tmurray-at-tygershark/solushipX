import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Fetches the Google Maps API key from Firebase Functions
 * @returns {Promise<string>} The Google Maps API key
 */
export const getMapsApiKey = async () => {
  try {
    const functions = getFunctions();
    const getMapsKey = httpsCallable(functions, 'getMapsApiKey');
    const result = await getMapsKey();
    return result.data.key;
  } catch (error) {
    console.error('Error fetching Maps API key:', error);
    throw new Error('Failed to fetch Google Maps API key');
  }
}; 