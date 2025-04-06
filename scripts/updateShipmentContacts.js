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

// Helper function to generate random phone number
function generateRandomPhone() {
  const areaCode = Math.floor(Math.random() * 900) + 100; // 100-999
  const firstPart = Math.floor(Math.random() * 900) + 100; // 100-999
  const secondPart = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  return `${areaCode}${firstPart}${secondPart}`;
}

// Helper function to generate random email
function generateRandomEmail(name) {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'company.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomNum = Math.floor(Math.random() * 1000);
  return `${sanitizedName}${randomNum}@${domain}`;
}

async function updateShipmentContacts() {
  try {
    console.log('Starting shipment contacts update...');
    
    // Get all shipments
    const shipmentsRef = collection(db, 'shipments');
    const shipmentsSnapshot = await getDocs(shipmentsRef);
    console.log(`Found ${shipmentsSnapshot.size} shipments`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each shipment
    for (const docSnapshot of shipmentsSnapshot.docs) {
      try {
        const shipmentData = docSnapshot.data();
        
        // Skip if shipment doesn't have from or to
        if (!shipmentData.from || !shipmentData.to) {
          console.log(`Skipped: Shipment ${docSnapshot.id} (missing from or to data)`);
          skippedCount++;
          continue;
        }
        
        // Generate random contact information for from
        const fromPhone = generateRandomPhone();
        const fromEmail = generateRandomEmail(shipmentData.from.attention || 'sender');
        
        // Generate random contact information for to
        const toPhone = generateRandomPhone();
        const toEmail = generateRandomEmail(shipmentData.to.attention || 'recipient');
        
        // Update the shipment document with the new contact information
        const shipmentRef = doc(db, 'shipments', docSnapshot.id);
        await updateDoc(shipmentRef, {
          'from.phone': fromPhone,
          'from.email': fromEmail,
          'to.phone': toPhone,
          'to.email': toEmail
        });
        
        console.log(`Updated: Shipment ${docSnapshot.id}`);
        console.log(`  From: ${fromPhone} | ${fromEmail}`);
        console.log(`  To: ${toPhone} | ${toEmail}`);
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
    console.error('Error updating shipment contacts:', error);
  }
}

// Run the update function
console.log('Initializing shipment contacts update script...');
updateShipmentContacts().then(() => {
  console.log('Script completed.');
}).catch(error => {
  console.error('Script failed:', error);
}); 