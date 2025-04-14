import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Fetches the Google Maps API key from Firestore
 * @returns {Promise<string>} The Google Maps API key
 */
export const getMapsApiKey = async () => {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Fetch API key from Firestore
      const keysRef = collection(db, 'keys');
      const keysSnapshot = await getDocs(keysRef);

      if (!keysSnapshot.empty) {
        const firstDoc = keysSnapshot.docs[0];
        const key = firstDoc.data().googleAPI;
        if (!key) {
          throw new Error('No API key found in Firestore');
        }
        return key;
      } else {
        throw new Error('API key document not found in Firestore');
      }
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