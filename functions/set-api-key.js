// Script to set the Google Maps API key in Firestore
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin with application default credentials
admin.initializeApp({
  projectId: 'solushipx'
});

const db = admin.firestore();

async function setApiKey() {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
      console.error('Google Places API key not found in environment variables');
      process.exit(1);
    }
    
    console.log('Setting Google Maps API key in Firestore...');
    console.log('API Key:', apiKey);
    
    // Set the API key in the KEYS collection
    await db.collection('KEYS').doc('google_maps_api_key').set({
      value: apiKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Successfully set Google Maps API key in Firestore');
    process.exit(0);
  } catch (error) {
    console.error('Error setting API key:', error);
    process.exit(1);
  }
}

setApiKey(); 