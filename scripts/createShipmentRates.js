const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, subcollection, addDoc } = require('firebase/firestore');
require('dotenv').config({ path: '../.env' });

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to generate random number within a range
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to generate random date within a range
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate random rate data
function generateRandomRate(shipmentId) {
  const carriers = ['FedEx', 'UPS', 'DHL', 'USPS', 'Canada Post', 'Purolator', 'TForce', 'XPO Logistics'];
  const services = ['Ground', 'Express', 'Priority', 'Standard', 'Economy', 'Next Day', '2 Day', '3 Day'];
  const currencies = ['USD', 'CAD', 'EUR', 'GBP'];
  
  const carrier = carriers[getRandomNumber(0, carriers.length - 1)];
  const service = services[getRandomNumber(0, services.length - 1)];
  const transitDays = getRandomNumber(1, 10);
  
  // Generate dates
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + transitDays);
  
  const freightCharges = parseFloat((Math.random() * 1000 + 100).toFixed(2));
  const fuelCharges = parseFloat((freightCharges * 0.15).toFixed(2));
  const serviceCharges = parseFloat((Math.random() * 200 + 50).toFixed(2));
  const guaranteeCharge = Math.random() > 0.5 ? parseFloat((Math.random() * 100 + 25).toFixed(2)) : 0;
  const totalCharges = parseFloat((freightCharges + fuelCharges + serviceCharges + guaranteeCharge).toFixed(2));
  
  return {
    shipmentId: shipmentId,
    carrier: carrier,
    service: service,
    transitDays: transitDays,
    deliveryDate: formatDate(futureDate),
    freightCharges: freightCharges,
    fuelCharges: fuelCharges,
    serviceCharges: serviceCharges,
    guaranteeCharge: guaranteeCharge,
    totalCharges: totalCharges,
    currency: currencies[getRandomNumber(0, currencies.length - 1)],
    guaranteed: guaranteeCharge > 0,
    quoteId: `QUOTE${getRandomNumber(1000, 9999)}`,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function createShipmentRates() {
  try {
    console.log('Starting creation of shipment rates...');
    
    // Get all shipments
    const shipmentsSnapshot = await getDocs(collection(db, 'shipments'));
    console.log(`Found ${shipmentsSnapshot.size} shipments to process`);
    
    let createdCount = 0;
    let skippedCount = 0;
    
    // Process each shipment
    for (const shipmentDoc of shipmentsSnapshot.docs) {
      const shipmentData = shipmentDoc.data();
      const shipmentId = shipmentData.shipmentID;
      
      if (!shipmentId) {
        console.log(`Shipment ${shipmentDoc.id} does not have shipmentID, skipping`);
        skippedCount++;
        continue;
      }
      
      // Generate 1-3 random rates for each shipment
      const numRates = getRandomNumber(1, 3);
      console.log(`Creating ${numRates} rates for shipment ${shipmentId}`);
      
      for (let i = 0; i < numRates; i++) {
        const rateData = generateRandomRate(shipmentId);
        
        // Add rate to the rates subcollection
        await addDoc(collection(db, 'shipments', shipmentDoc.id, 'rates'), rateData);
        console.log(`Created rate ${i+1}/${numRates} for shipment ${shipmentId}`);
      }
      
      createdCount++;
    }
    
    console.log(`Migration completed successfully! Created rates for ${createdCount} shipments, skipped ${skippedCount} shipments.`);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
createShipmentRates(); 