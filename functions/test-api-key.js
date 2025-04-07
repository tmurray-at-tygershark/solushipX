// Load environment variables from .env file
require('dotenv').config();

// Log the Google Maps API key
console.log('==========================================');
console.log('GOOGLE PLACES API KEY:', process.env.GOOGLE_PLACES_API_KEY);
console.log('==========================================');

// Also check if there's a GOOGLE_MAPS_API_KEY
console.log('GOOGLE MAPS API KEY:', process.env.GOOGLE_MAPS_API_KEY);

// Log all environment variables (be careful with sensitive data)
console.log('All environment variables:');
Object.keys(process.env).forEach(key => {
  // Only log non-sensitive keys
  if (!key.includes('PASSWORD') && !key.includes('SECRET') && !key.includes('KEY')) {
    console.log(`${key}: ${process.env[key]}`);
  }
}); 