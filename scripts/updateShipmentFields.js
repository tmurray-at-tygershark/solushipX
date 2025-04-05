const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
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

// Helper function to generate random date between Jan 1, 2025 and April 5, 2025
function getRandomDate() {
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-04-05');
  const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
  return randomDate;
}

// Helper function to generate random time between 9am and 5pm
function getRandomTime() {
  const hours = Math.floor(Math.random() * 8) + 9; // 9am to 5pm
  const minutes = Math.floor(Math.random() * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper function to generate random freight class
function getRandomFreightClass() {
  const freightClasses = [50, 55, 60, 65, 70, 77.5, 85, 92.5, 100, 110, 125, 150, 175, 200, 250, 300, 400];
  return freightClasses[Math.floor(Math.random() * freightClasses.length)];
}

// Helper function to generate random booking reference number
function generateBookingReference() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to generate random package reference number
function generatePackageReference() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to get random signature required type
function getRandomSignatureType() {
  const types = ['none', 'any', 'adult'];
  return types[Math.floor(Math.random() * types.length)];
}

// Helper function to get random shipment creation source
function getRandomCreationSource() {
  const sources = ['ecomm', 'api', 'soluship'];
  return sources[Math.floor(Math.random() * sources.length)];
}

async function updateShipmentFields() {
  try {
    // Get all shipments
    const shipmentsRef = collection(db, 'shipments');
    const shipmentsSnapshot = await getDocs(shipmentsRef);
    console.log(`Found ${shipmentsSnapshot.size} shipments`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each shipment
    for (const docSnapshot of shipmentsSnapshot.docs) {
      try {
        const shipmentData = docSnapshot.data();
        
        // Generate random data for the shipment
        const shipmentDate = getRandomDate();
        const earliestPickupTime = getRandomTime();
        const latestPickupTime = getRandomTime();
        const earliestDeliveryTime = getRandomTime();
        const latestDeliveryTime = getRandomTime();
        
        // Generate random shipment type (courier or freight)
        const shipmentType = Math.random() > 0.5 ? 'courier' : 'freight';
        
        // Generate random booking reference
        const bookingReferenceNumber = generateBookingReference();
        
        // Generate random signature required type
        const signatureRequiredType = getRandomSignatureType();
        
        // Generate random shipment creation source
        const shipmentCreationSource = getRandomCreationSource();
        
        // Generate random package data
        const packageCount = Math.floor(Math.random() * 3) + 1; // 1-3 packages
        const packages = [];
        
        for (let i = 0; i < packageCount; i++) {
          // 70% chance of having a package reference number
          const hasPackageReference = Math.random() > 0.3;
          
          packages.push({
            measurementUnits: Math.random() > 0.5 ? 'imperial' : 'metric',
            packageQuantity: Math.floor(Math.random() * 5) + 1,
            freightclass: getRandomFreightClass(),
            declaredValue: Math.floor(Math.random() * 1000) + 100,
            declaredValueCurrency: Math.random() > 0.5 ? 'USD' : 'CAD',
            stackable: Math.random() > 0.5,
            ...(hasPackageReference && { packageReferenceNumber: generatePackageReference() })
          });
        }
        
        // Update the shipment document with the new fields
        const shipmentRef = doc(db, 'shipments', docSnapshot.id);
        await updateDoc(shipmentRef, {
          // General Shipment Info
          shipmentType: shipmentType,
          bookingReferenceNumber: bookingReferenceNumber,
          bookingReferenceNumberType: 'STANDARD',
          shipmentBillType: 'PREPAID',
          shipmentDate: shipmentDate,
          earliestPickupTime: earliestPickupTime,
          latestPickupTime: latestPickupTime,
          earliestDeliveryTime: earliestDeliveryTime,
          latestDeliveryTime: latestDeliveryTime,
          declineAdditonalInsurance: Math.random() > 0.7, // 30% chance of declining
          hazardousMaterial: Math.random() > 0.9, // 10% chance of hazardous material
          signatureRequiredType: signatureRequiredType,
          shipmentCreationSource: shipmentCreationSource,
          
          // Package info
          packages: packages
        });
        
        console.log(`Updated: Shipment ${docSnapshot.id} with new fields`);
        updatedCount++;
      } catch (error) {
        console.error(`Error updating shipment ${docSnapshot.id}:`, error);
        errorCount++;
      }
    }

    console.log('\nUpdate Summary:');
    console.log(`Total shipments processed: ${shipmentsSnapshot.size}`);
    console.log(`Shipments updated: ${updatedCount}`);
    console.log(`Shipments skipped: ${skippedCount}`);
    console.log(`Shipments with errors: ${errorCount}`);

  } catch (error) {
    console.error('Error updating shipment fields:', error);
  }
}

// Run the update function
updateShipmentFields(); 