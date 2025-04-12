const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');
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

// Sample customer data with multiple addresses and contacts
const customers = [
  {
    companyId: 'OSJ4266', // Replace with your company ID
    name: 'Acme Corporation',
    company: 'Acme Corp',
    customerId: 'ACME001',
    status: 'active',
    type: 'business',
    industry: 'Manufacturing',
    contacts: [
      {
        id: 'cont1',
        name: 'John Smith',
        title: 'Shipping Manager',
        email: 'john.smith@acme.com',
        phone: '555-0123',
        isPrimary: true
      },
      {
        id: 'cont2',
        name: 'Sarah Johnson',
        title: 'Logistics Coordinator',
        email: 'sarah.j@acme.com',
        phone: '555-0124',
        isPrimary: false
      }
    ],
    addresses: [
      {
        name: 'Main Office',
        type: 'shipping',
        default: true,
        attention: 'John Smith',
        street: '123 Business Ave',
        street2: 'Suite 100',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US',
        contactName: 'John Smith',
        contactPhone: '555-0123',
        contactEmail: 'john.smith@acme.com',
        specialInstructions: 'Please call before delivery'
      },
      {
        name: 'Warehouse',
        type: 'shipping',
        default: false,
        attention: 'Sarah Johnson',
        street: '456 Industrial Park',
        street2: 'Building B',
        city: 'Newark',
        state: 'NJ',
        zip: '07102',
        country: 'US',
        contactName: 'Sarah Johnson',
        contactPhone: '555-0124',
        contactEmail: 'sarah.j@acme.com',
        specialInstructions: 'Loading dock available 24/7'
      }
    ],
    preferences: {
      defaultCarrier: 'FedEx',
      defaultService: 'Ground',
      notificationEmail: 'shipping@acme.com',
      notificationPhone: '555-0123'
    },
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date())
  },
  {
    companyId: 'OSJ4266',
    name: 'Tech Solutions Inc',
    company: 'Tech Solutions',
    customerId: 'TECH001',
    status: 'active',
    type: 'business',
    industry: 'Technology',
    contacts: [
      {
        id: 'cont3',
        name: 'Michael Brown',
        title: 'Operations Director',
        email: 'm.brown@techsolutions.com',
        phone: '555-0125',
        isPrimary: true
      },
      {
        id: 'cont4',
        name: 'Emily Davis',
        title: 'Supply Chain Manager',
        email: 'e.davis@techsolutions.com',
        phone: '555-0126',
        isPrimary: false
      }
    ],
    addresses: [
      {
        name: 'HQ',
        type: 'shipping',
        default: true,
        attention: 'Michael Brown',
        street: '456 Tech Drive',
        street2: 'Floor 3',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'US',
        contactName: 'Michael Brown',
        contactPhone: '555-0125',
        contactEmail: 'm.brown@techsolutions.com',
        specialInstructions: 'Delivery hours: 9 AM - 5 PM'
      },
      {
        name: 'Data Center',
        type: 'shipping',
        default: false,
        attention: 'Emily Davis',
        street: '789 Server Lane',
        street2: 'Unit 200',
        city: 'San Jose',
        state: 'CA',
        zip: '95112',
        country: 'US',
        contactName: 'Emily Davis',
        contactPhone: '555-0126',
        contactEmail: 'e.davis@techsolutions.com',
        specialInstructions: 'Security clearance required'
      }
    ],
    preferences: {
      defaultCarrier: 'UPS',
      defaultService: 'Next Day Air',
      notificationEmail: 'logistics@techsolutions.com',
      notificationPhone: '555-0125'
    },
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date())
  },
  {
    companyId: 'OSJ4266',
    name: 'Global Logistics Ltd',
    company: 'Global Logistics',
    customerId: 'GLOB001',
    status: 'active',
    type: 'business',
    industry: 'Logistics',
    contacts: [
      {
        id: 'cont5',
        name: 'Robert Wilson',
        title: 'Fleet Manager',
        email: 'r.wilson@globallogistics.com',
        phone: '555-0127',
        isPrimary: true
      },
      {
        id: 'cont6',
        name: 'Lisa Anderson',
        title: 'Distribution Manager',
        email: 'l.anderson@globallogistics.com',
        phone: '555-0128',
        isPrimary: false
      }
    ],
    addresses: [
      {
        name: 'Distribution Center',
        type: 'shipping',
        default: true,
        attention: 'Robert Wilson',
        street: '789 Logistics Way',
        street2: 'Unit 200',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        country: 'US',
        contactName: 'Robert Wilson',
        contactPhone: '555-0127',
        contactEmail: 'r.wilson@globallogistics.com',
        specialInstructions: 'Loading dock available'
      },
      {
        name: 'Regional Hub',
        type: 'shipping',
        default: false,
        attention: 'Lisa Anderson',
        street: '321 Transport Ave',
        street2: 'Building C',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
        country: 'US',
        contactName: 'Lisa Anderson',
        contactPhone: '555-0128',
        contactEmail: 'l.anderson@globallogistics.com',
        specialInstructions: '24/7 access available'
      }
    ],
    preferences: {
      defaultCarrier: 'DHL',
      defaultService: 'Express',
      notificationEmail: 'operations@globallogistics.com',
      notificationPhone: '555-0127'
    },
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date())
  }
];

async function createSampleCustomers() {
  try {
    console.log('Creating sample customers...');
    
    for (const customer of customers) {
      const docRef = await addDoc(collection(db, 'customers'), customer);
      console.log(`Created customer ${customer.name} with ID:`, docRef.id);
    }

    console.log('Sample customers created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample customers:', error);
    process.exit(1);
  }
}

// Run the script
createSampleCustomers(); 