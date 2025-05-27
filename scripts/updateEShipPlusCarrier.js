const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateEShipPlusCarrier() {
  try {
    console.log('Updating eShipPlus carrier with endpoints configuration...');
    
    // Find the eShipPlus carrier
    const carriersRef = db.collection('carriers');
    const snapshot = await carriersRef.where('carrierID', '==', 'ESHIPPLUS').get();
    
    if (snapshot.empty) {
      console.log('eShipPlus carrier not found. Creating new carrier...');
      
      // Create new eShipPlus carrier
      const newCarrierData = {
        name: 'EShip Plus',
        carrierID: 'ESHIPPLUS',
        type: 'freight',
        enabled: true,
        status: 'active',
        logoFileName: 'eship.png',
        apiCredentials: {
          hostURL: 'https://cloudstaging.eshipplus.com/services/rest/',
          username: 'ryan.blakey',
          password: 'Reynard123$',
          secret: 'a33b98de-a066-4766-ac9e-1eab39ce6806',
          accountNumber: 'TENANT1',
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
      
      await carriersRef.add(newCarrierData);
      console.log('✅ New eShipPlus carrier created successfully with endpoints!');
    } else {
      // Update existing carrier
      const carrierDoc = snapshot.docs[0];
      const carrierData = carrierDoc.data();
      
      console.log('Found existing eShipPlus carrier:', carrierData.name);
      
      // Update with endpoints if not already present
      const updateData = {
        apiCredentials: {
          ...carrierData.apiCredentials,
          endpoints: {
            rate: 'RateShipment.aspx',
            booking: 'BookShipment.aspx',
            tracking: 'TrackShipment.aspx',
            cancel: 'CancelShipment.aspx',
            labels: 'GetLabels.aspx'
          }
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await carrierDoc.ref.update(updateData);
      console.log('✅ eShipPlus carrier updated successfully with endpoints!');
    }
    
    // Verify the update
    const verifySnapshot = await carriersRef.where('carrierID', '==', 'ESHIPPLUS').get();
    if (!verifySnapshot.empty) {
      const updatedCarrier = verifySnapshot.docs[0].data();
      console.log('\n📋 Updated carrier configuration:');
      console.log('Name:', updatedCarrier.name);
      console.log('Type:', updatedCarrier.type);
      console.log('Host URL:', updatedCarrier.apiCredentials?.hostURL);
      console.log('Endpoints:', updatedCarrier.apiCredentials?.endpoints);
    }
    
  } catch (error) {
    console.error('❌ Error updating eShipPlus carrier:', error);
  } finally {
    process.exit(0);
  }
}

updateEShipPlusCarrier(); 