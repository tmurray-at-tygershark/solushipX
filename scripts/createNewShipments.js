const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc, addDoc, serverTimestamp } = require('firebase/firestore');
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

// Helper function to generate random dates within a range
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper function to generate random package data
function generateRandomPackage() {
  return {
    itemDescription: `Package ${Math.floor(Math.random() * 1000)}`,
    packagingType: Math.random() > 0.5 ? 'BOX' : 'PALLET',
    packagingQuantity: Math.floor(Math.random() * 5) + 1,
    stackable: Math.random() > 0.3,
    weight: Math.floor(Math.random() * 100) + 1,
    height: Math.floor(Math.random() * 24) + 1,
    width: Math.floor(Math.random() * 24) + 1,
    length: Math.floor(Math.random() * 24) + 1,
    freightClass: Math.random() > 0.5 ? '50' : '70',
    declaredValue: Math.floor(Math.random() * 1000) + 100,
    measurementUnits: Math.random() > 0.5 ? 'imperial' : 'metric',
    declaredValueCurrency: Math.random() > 0.5 ? 'USD' : 'CAD'
  };
}

// Helper function to generate random address
function generateRandomAddress(type) {
  const cities = ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'];
  const provinces = ['ON', 'BC', 'QC', 'AB', 'ON'];
  const countries = ['CA', 'US'];
  const randomIndex = Math.floor(Math.random() * cities.length);
  
  return {
    company: `${type} Company ${Math.floor(Math.random() * 1000)}`,
    attentionName: `${type} Manager`,
    street: `${Math.floor(Math.random() * 9999) + 1} ${type} Street`,
    street2: Math.random() > 0.5 ? `Unit ${Math.floor(Math.random() * 100) + 1}` : '',
    city: cities[randomIndex],
    state: provinces[randomIndex],
    country: countries[Math.floor(Math.random() * countries.length)],
    postalCode: Math.random() > 0.5 ? 'M5V 2H1' : '90210',
    contactName: `${type} Contact`,
    contactPhone: `555-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
    contactEmail: `${type.toLowerCase()}@example.com`,
    specialInstructions: `${type} special instructions`
  };
}

async function createNewShipments() {
  try {
    console.log('Starting shipment creation process...');
    
    // Delete all existing shipments
    const shipmentsRef = collection(db, 'shipments');
    const shipmentsSnapshot = await getDocs(shipmentsRef);
    
    console.log(`Found ${shipmentsSnapshot.size} existing shipments to delete...`);
    
    for (const doc of shipmentsSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    
    console.log('All existing shipments deleted.');
    
    // Create 20 new shipments
    const companyId = 'COMPANY123'; // Replace with actual company ID
    const customerId = 'CUSTOMER123'; // Replace with actual customer ID
    
    for (let i = 0; i < 20; i++) {
      const shipmentDate = getRandomDate(new Date(2024, 0, 1), new Date());
      const packageCount = Math.floor(Math.random() * 3) + 1; // 1-3 packages
      
      // Create the main shipment document
      const shipmentData = {
        // Core metadata
        companyId,
        customerId,
        status: Math.random() > 0.7 ? 'in_transit' : 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        // Shipment info
        shipmentInfo: {
          shipmentType: Math.random() > 0.5 ? 'courier' : 'freight',
          internationalShipment: Math.random() > 0.8,
          shipperReferenceNumber: `REF${Math.floor(Math.random() * 10000)}`,
          bookingReferenceNumber: `BOOK${Math.floor(Math.random() * 10000)}`,
          bookingReferenceType: 'STANDARD',
          shipmentBillType: 'PREPAID',
          shipmentDate: shipmentDate.toISOString(),
          earliestPickupTime: '09:00',
          latestPickupTime: '17:00',
          earliestDeliveryTime: '09:00',
          latestDeliveryTime: '17:00',
          dangerousGoodsType: Math.random() > 0.9 ? 'HAZMAT' : 'none',
          signatureServiceType: Math.random() > 0.7 ? 'SIGNATURE_REQUIRED' : 'none',
          holdForPickup: Math.random() > 0.8,
          saturdayDelivery: Math.random() > 0.9
        },
        
        // Addresses
        shipFrom: generateRandomAddress('Origin'),
        shipTo: generateRandomAddress('Destination'),
        
        // Tracking info
        trackingNumber: `TRACK${Math.floor(Math.random() * 1000000)}`,
        carrier: Math.random() > 0.5 ? 'FedEx' : 'UPS',
        service: Math.random() > 0.5 ? 'Express' : 'Ground',
        
        // Rate info
        selectedRate: {
          carrier: Math.random() > 0.5 ? 'FedEx' : 'UPS',
          service: Math.random() > 0.5 ? 'Express' : 'Ground',
          transitDays: Math.floor(Math.random() * 5) + 1,
          deliveryDate: new Date(shipmentDate.getTime() + (Math.floor(Math.random() * 5) + 1) * 24 * 60 * 60 * 1000).toISOString(),
          freightCharges: Math.floor(Math.random() * 1000) + 100,
          fuelCharges: Math.floor(Math.random() * 50) + 10,
          serviceCharges: Math.floor(Math.random() * 100) + 20,
          guaranteeCharge: Math.floor(Math.random() * 30) + 5,
          totalCharges: Math.floor(Math.random() * 1200) + 150,
          currency: 'USD',
          guaranteed: Math.random() > 0.7
        },
        
        // History
        history: [
          {
            status: 'created',
            timestamp: new Date(),
            location: 'System',
            notes: 'Shipment created'
          }
        ]
      };
      
      // Add the shipment document
      const shipmentRef = await addDoc(shipmentsRef, shipmentData);
      
      // Add packages to the subcollection
      const packagesRef = collection(db, 'shipments', shipmentRef.id, 'packages');
      for (let j = 0; j < packageCount; j++) {
        await addDoc(packagesRef, generateRandomPackage());
      }
      
      console.log(`Created shipment ${i + 1} with ${packageCount} packages`);
    }
    
    console.log('Successfully created 20 new shipments with packages');
    
  } catch (error) {
    console.error('Error creating shipments:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createNewShipments(); 