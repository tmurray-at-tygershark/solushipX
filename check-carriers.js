const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./functions/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'solushipx'
});

const db = admin.firestore();

async function checkAndFixCarriers() {
  try {
    console.log('Checking carriers in Firestore...');
    
    // Get all carriers
    const carriersSnapshot = await db.collection('carriers').get();
    
    if (carriersSnapshot.empty) {
      console.log('No carriers found in database');
    } else {
      console.log(`Found ${carriersSnapshot.size} carriers:`);
      carriersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, carrierID: ${data.carrierID}, name: ${data.name}, enabled: ${data.enabled}, status: ${data.status}`);
        if (data.apiCredentials) {
          console.log(`  Has apiCredentials: ${Object.keys(data.apiCredentials)}`);
          if (data.apiCredentials.endpoints) {
            console.log(`  Endpoints: ${Object.keys(data.apiCredentials.endpoints)}`);
          }
        }
      });
    }
    
    // Check specifically for ESHIPPLUS carrier
    const eshipPlusQuery = await db.collection('carriers')
      .where('carrierID', '==', 'ESHIPPLUS')
      .get();
    
    if (eshipPlusQuery.empty) {
      console.log('\nNo ESHIPPLUS carrier found. Creating one...');
      
      const eshipPlusCarrier = {
        name: 'eShipPlus',
        carrierID: 'ESHIPPLUS',
        type: 'freight',
        enabled: true,
        status: 'active',
        logoFileName: 'eshipplus.png',
        apiCredentials: {
          accountNumber: 'TENANT1',
          hostURL: 'https://cloudstaging.eshipplus.com/services/rest/',
          username: 'ryan.blakey',
          password: 'Reynard123$',
          secret: 'a33b98de-a066-4766-ac9e-1eab39ce6806',
          endpoints: {
            rate: 'RateShipment.aspx',
            booking: 'BookShipment.aspx',
            tracking: 'TrackShipment.aspx',
            cancel: 'CancelShipment.aspx',
            labels: 'GetLabels.aspx'
          }
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('carriers').add(eshipPlusCarrier);
      console.log(`Created ESHIPPLUS carrier with ID: ${docRef.id}`);
    } else {
      console.log('\nESHIPPLUS carrier found:');
      const eshipDoc = eshipPlusQuery.docs[0];
      const eshipData = eshipDoc.data();
      console.log(`- Document ID: ${eshipDoc.id}`);
      console.log(`- Enabled: ${eshipData.enabled}`);
      console.log(`- Status: ${eshipData.status}`);
      console.log(`- Has apiCredentials: ${!!eshipData.apiCredentials}`);
      
      if (eshipData.apiCredentials) {
        console.log(`- Has endpoints: ${!!eshipData.apiCredentials.endpoints}`);
        if (eshipData.apiCredentials.endpoints) {
          console.log(`- Endpoints: ${Object.keys(eshipData.apiCredentials.endpoints)}`);
        }
      }
      
      // Check if we need to update the carrier with endpoints
      if (!eshipData.apiCredentials?.endpoints) {
        console.log('\nUpdating ESHIPPLUS carrier with endpoints...');
        await eshipDoc.ref.update({
          'apiCredentials.endpoints': {
            rate: 'RateShipment.aspx',
            booking: 'BookShipment.aspx',
            tracking: 'TrackShipment.aspx',
            cancel: 'CancelShipment.aspx',
            labels: 'GetLabels.aspx'
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Updated ESHIPPLUS carrier with endpoints');
      }
    }
    
    console.log('\nCarrier check complete!');
    
  } catch (error) {
    console.error('Error checking carriers:', error);
  } finally {
    process.exit(0);
  }
}

checkAndFixCarriers(); 