import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Fetches the Google Maps API key from Firebase Functions
 * @returns {Promise<string>} The Google Maps API key
 */
export const getMapsApiKey = async () => {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/getMapsApiKey', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.key) {
        throw new Error('Invalid API key response');
      }

      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to get API key');
      }

      return data.key;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to fetch Google Maps API key after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
    }
  }
}; 