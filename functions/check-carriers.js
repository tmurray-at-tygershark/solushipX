const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'solushipx'
});

const db = admin.firestore();

async function checkCarriers() {
  try {
    console.log('🔍 Checking carrier configurations...\n');
    
    // Get all carriers
    const carriersRef = db.collection('carriers');
    const snapshot = await carriersRef.get();
    
    console.log(`Found ${snapshot.size} carrier documents in the database:\n`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📋 Carrier: ${data.name || data.carrierID || doc.id}`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - carrierID: ${data.carrierID || 'Not set'}`);
      console.log(`   - name: ${data.name || 'Not set'}`);
      console.log(`   - enabled: ${data.enabled}`);
      console.log(`   - status: ${data.status || 'Not set'}`);
      console.log(`   - Has apiCredentials: ${!!data.apiCredentials}`);
      
      if (data.apiCredentials) {
        console.log(`   - hostURL: ${data.apiCredentials.hostURL || 'Not set'}`);
        console.log(`   - username: ${data.apiCredentials.username ? '***' : 'Not set'}`);
        console.log(`   - password: ${data.apiCredentials.password ? '***' : 'Not set'}`);
        console.log(`   - Has endpoints: ${!!data.apiCredentials.endpoints}`);
        
        if (data.apiCredentials.endpoints) {
          console.log(`   - Endpoints:`, Object.keys(data.apiCredentials.endpoints));
        }
      }
      console.log('');
    });
    
    // Specifically check for eShipPlus and Polaris
    console.log('🎯 Checking specific carriers mentioned in error:\n');
    
    const eshipQuery = await carriersRef.where('carrierID', '==', 'ESHIPPLUS').get();
    const polarisQuery = await carriersRef.where('carrierID', '==', 'POLARISTRANSPORTATION').get();
    
    console.log(`eShipPlus records found: ${eshipQuery.size}`);
    if (!eshipQuery.empty) {
      const eshipData = eshipQuery.docs[0].data();
      console.log('eShipPlus config:', {
        enabled: eshipData.enabled,
        hasCredentials: !!eshipData.apiCredentials,
        hasEndpoints: !!eshipData.apiCredentials?.endpoints
      });
    }
    
    console.log(`\nPolaris Transportation records found: ${polarisQuery.size}`);
    if (!polarisQuery.empty) {
      const polarisData = polarisQuery.docs[0].data();
      console.log('Polaris config:', {
        enabled: polarisData.enabled,
        hasCredentials: !!polarisData.apiCredentials,
        hasEndpoints: !!polarisData.apiCredentials?.endpoints
      });
    }
    
  } catch (error) {
    console.error('Error checking carriers:', error);
  } finally {
    process.exit(0);
  }
}

checkCarriers(); 