const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');
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

// Helper function to convert all numbers to strings in an object
function convertNumbersToStrings(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  const newObj = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (typeof obj[key] === 'number' && !['freightCharges', 'fuelCharges', 'serviceCharges', 'guaranteeCharge', 'totalCharges', 'value'].includes(key)) {
      newObj[key] = String(obj[key]);
    } else if (typeof obj[key] === 'object') {
      newObj[key] = convertNumbersToStrings(obj[key]);
    } else {
      newObj[key] = obj[key];
    }
  }
  
  return newObj;
}

// Sample data for shipments
const shipments = [
  {
    shipmentID: 'SHIP001',
    status: 'In Transit',
    shipmentInfo: {
      shipmentType: 'LTL',
      referenceNumber: 'REF001',
      shipmentDate: '2024-03-15',
      earliestPickup: '2024-03-15 09:00',
      latestPickup: '2024-03-15 17:00',
      earliestDelivery: '2024-03-18 09:00',
      latestDelivery: '2024-03-18 17:00'
    },
    from: {
      company: 'Tech Solutions Inc',
      contactPhone: '4165550199',
      contactEmail: 'shipping@techsolutions.com',
      address1: '123 Innovation Drive',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5V 2T6',
      country: 'Canada'
    },
    to: {
      company: 'Digital Dynamics LLC',
      contactPhone: '6045550199',
      contactEmail: 'receiving@digitaldynamics.com',
      address1: '456 Tech Avenue',
      city: 'Vancouver',
      state: 'BC',
      postalCode: 'V6B 4N7',
      country: 'Canada'
    },
    packages: [
      {
        description: 'Server Equipment',
        quantity: '2',
        weight: '150',
        dimensions: {
          length: '48',
          width: '24',
          height: '36'
        },
        freightClass: '70',
        value: 5000.00
      }
    ],
    history: [
      {
        id: '1',
        status: 'Shipment Created',
        location: 'Toronto, ON',
        timestamp: Timestamp.fromDate(new Date('2024-03-15T10:00:00')),
        description: 'Shipment information received and processed'
      },
      {
        id: '2',
        status: 'Picked Up',
        location: 'Toronto, ON',
        timestamp: Timestamp.fromDate(new Date('2024-03-15T14:30:00')),
        description: 'Shipment picked up from sender'
      },
      {
        id: '3',
        status: 'In Transit',
        location: 'Thunder Bay, ON',
        timestamp: Timestamp.fromDate(new Date('2024-03-16T09:15:00')),
        description: 'Shipment in transit to destination'
      }
    ],
    createdAt: Timestamp.fromDate(new Date('2024-03-15T10:00:00')),
    updatedAt: Timestamp.fromDate(new Date('2024-03-16T09:15:00'))
  },
  {
    shipmentID: 'SHIP002',
    status: 'Delivered',
    shipmentInfo: {
      shipmentType: 'Express',
      referenceNumber: 'REF002',
      shipmentDate: '2024-03-14',
      earliestPickup: '2024-03-14 08:00',
      latestPickup: '2024-03-14 12:00',
      earliestDelivery: '2024-03-15 09:00',
      latestDelivery: '2024-03-15 17:00'
    },
    from: {
      company: 'Global Electronics',
      contactPhone: '5145550199',
      contactEmail: 'shipping@globalelectronics.com',
      address1: '789 Industrial Blvd',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H3B 2Y5',
      country: 'Canada'
    },
    to: {
      company: 'West Coast Technologies',
      contactPhone: '4035550199',
      contactEmail: 'receiving@westcoasttech.com',
      address1: '321 Innovation Park',
      city: 'Calgary',
      state: 'AB',
      postalCode: 'T2P 4J8',
      country: 'Canada'
    },
    packages: [
      {
        description: 'Electronic Components',
        quantity: '5',
        weight: '75',
        dimensions: {
          length: '24',
          width: '18',
          height: '12'
        },
        freightClass: '85',
        value: 3500.00
      }
    ],
    history: [
      {
        id: '1',
        status: 'Shipment Created',
        location: 'Montreal, QC',
        timestamp: Timestamp.fromDate(new Date('2024-03-14T08:30:00')),
        description: 'Shipment information received and processed'
      },
      {
        id: '2',
        status: 'Picked Up',
        location: 'Montreal, QC',
        timestamp: Timestamp.fromDate(new Date('2024-03-14T10:45:00')),
        description: 'Shipment picked up from sender'
      },
      {
        id: '3',
        status: 'In Transit',
        location: 'Ottawa, ON',
        timestamp: Timestamp.fromDate(new Date('2024-03-14T15:20:00')),
        description: 'Shipment in transit to destination'
      },
      {
        id: '4',
        status: 'Delivered',
        location: 'Calgary, AB',
        timestamp: Timestamp.fromDate(new Date('2024-03-15T14:30:00')),
        description: 'Shipment delivered to recipient'
      }
    ],
    createdAt: Timestamp.fromDate(new Date('2024-03-14T08:30:00')),
    updatedAt: Timestamp.fromDate(new Date('2024-03-15T14:30:00'))
  }
];

// Sample data for shipment rates
const shipmentRates = [
  {
    shipmentId: 'SHIP001',
    carrier: 'FedEx',
    service: 'Freight Priority',
    transitDays: '3',
    deliveryDate: '2024-03-18',
    freightCharges: 850.00,
    fuelCharges: 127.50,
    serviceCharges: 75.00,
    guaranteeCharge: 50.00,
    totalCharges: 1102.50,
    currency: 'CAD',
    guaranteed: true,
    quoteId: 'QUOTE001',
    createdAt: new Date('2024-03-15T10:00:00Z'),
    updatedAt: new Date('2024-03-15T10:00:00Z')
  },
  {
    shipmentId: 'SHIP002',
    carrier: 'UPS',
    service: 'Express Freight',
    transitDays: '1',
    deliveryDate: '2024-03-15',
    freightCharges: 625.00,
    fuelCharges: 93.75,
    serviceCharges: 50.00,
    guaranteeCharge: 75.00,
    totalCharges: 843.75,
    currency: 'CAD',
    guaranteed: true,
    quoteId: 'QUOTE002',
    createdAt: new Date('2024-03-14T08:30:00Z'),
    updatedAt: new Date('2024-03-14T08:30:00Z')
  }
];

async function populateFirebase() {
  try {
    // Convert numbers to strings in the data
    const processedShipments = shipments.map(shipment => convertNumbersToStrings(shipment));
    const processedRates = shipmentRates.map(rate => convertNumbersToStrings(rate));

    // Add shipments
    console.log('Adding shipments...');
    for (const shipment of processedShipments) {
      const docRef = await addDoc(collection(db, 'shipments'), shipment);
      console.log('Added shipment with ID:', docRef.id);
    }

    // Add shipment rates
    console.log('Adding shipment rates...');
    for (const rate of processedRates) {
      const docRef = await addDoc(collection(db, 'shipmentRates'), rate);
      console.log('Added shipment rate with ID:', docRef.id);
    }

    console.log('Data population completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error populating data:', error);
    process.exit(1);
  }
}

// Run the population script
populateFirebase(); 