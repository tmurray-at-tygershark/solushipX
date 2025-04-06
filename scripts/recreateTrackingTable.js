const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc, addDoc, serverTimestamp, query, where } = require('firebase/firestore');
require('dotenv').config();

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

// Helper function to generate random tracking number
function generateTrackingNumber(carrier) {
  const prefix = carrier === 'UPS' ? '1Z' : 'FX';
  const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return `${prefix}${random}`;
}

// Helper function to generate random location
function generateRandomLocation() {
  const cities = [
    { city: 'Houston', state: 'TX', country: 'USA', zip: '77002' },
    { city: 'Memphis', state: 'TN', country: 'USA', zip: '38116' },
    { city: 'Chicago', state: 'IL', country: 'USA', zip: '60601' },
    { city: 'Los Angeles', state: 'CA', country: 'USA', zip: '90001' },
    { city: 'New York', state: 'NY', country: 'USA', zip: '10001' },
    { city: 'Miami', state: 'FL', country: 'USA', zip: '33101' },
    { city: 'Seattle', state: 'WA', country: 'USA', zip: '98101' },
    { city: 'Denver', state: 'CO', country: 'USA', zip: '80201' }
  ];
  return cities[Math.floor(Math.random() * cities.length)];
}

// Helper function to generate tracking events
function generateTrackingEvents(carrier, startDate) {
  const events = [];
  const statuses = [
    { status: 'picked_up', description: 'Package picked up by carrier' },
    { status: 'in_transit', description: 'Package in transit to destination' },
    { status: 'out_for_delivery', description: 'Package out for delivery' },
    { status: 'delivered', description: 'Package successfully delivered' }
  ];

  let currentDate = new Date(startDate);
  
  statuses.forEach((status, index) => {
    // Add some random hours to the timestamp
    currentDate = new Date(currentDate.getTime() + (Math.random() * 24 + 12) * 60 * 60 * 1000);
    
    events.push({
      description: status.description,
      location: generateRandomLocation(),
      status: status.status,
      timestamp: currentDate
    });
  });

  return events;
}

async function recreateTrackingTable() {
  try {
    console.log('Starting tracking table recreation process...');
    
    // Delete all existing tracking records
    const trackingRef = collection(db, 'tracking');
    const trackingSnapshot = await getDocs(trackingRef);
    
    console.log(`Found ${trackingSnapshot.size} existing tracking records to delete...`);
    
    for (const doc of trackingSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    
    console.log('All existing tracking records deleted.');
    
    // Get all shipments
    const shipmentsRef = collection(db, 'shipments');
    const shipmentsSnapshot = await getDocs(shipmentsRef);
    
    if (shipmentsSnapshot.empty) {
      console.log('No shipments found.');
      return;
    }

    console.log(`Found ${shipmentsSnapshot.size} shipments.`);
    
    // Create tracking record for each shipment
    for (const doc of shipmentsSnapshot.docs) {
      const shipment = doc.data();
      // Alternate between UPS and FedEx
      const carrier = Math.random() > 0.5 ? 'UPS' : 'FedEx';
      const startDate = new Date();
      
      const trackingData = {
        carrier,
        estimatedDeliveryDate: new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        events: generateTrackingEvents(carrier, startDate),
        lastUpdated: serverTimestamp(),
        shipmentId: shipment.shipmentId,
        status: 'processing',
        trackingNumber: generateTrackingNumber(carrier)
      };
      
      // Add tracking record
      await addDoc(trackingRef, trackingData);
      console.log(`Created tracking record for shipment ${shipment.shipmentId}`);
    }
    
    console.log('Successfully recreated tracking table with records for all shipments');
    
  } catch (error) {
    console.error('Error recreating tracking table:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
recreateTrackingTable(); 