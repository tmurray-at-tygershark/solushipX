const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  admin.initializeApp();
} catch (e) {
  // App already initialized
  console.log("Firebase already initialized");
}

const db = admin.firestore();

// Query companies collection
db.collection('companies').limit(2).get()
  .then(snapshot => {
    if (!snapshot.empty) {
      console.log(`Found ${snapshot.size} company documents`);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('\n=== Company Document ===');
        console.log('Document ID:', doc.id);
        console.log('Name:', data.name);
        
        // Check for address-related fields
        const addressFields = [
          'shipFromAddresses',
          'addresses',
          'locations',
          'originAddresses',
          'shipFromAddress',
          'address'
        ];
        
        console.log('\nAddress fields found:');
        addressFields.forEach(field => {
          if (data[field]) {
            if (Array.isArray(data[field])) {
              console.log(`- ${field}: Array with ${data[field].length} items`);
              if (data[field].length > 0) {
                console.log(`  First item keys: ${Object.keys(data[field][0]).join(', ')}`);
              }
            } else {
              console.log(`- ${field}: Object with keys: ${Object.keys(data[field]).join(', ')}`);
            }
          } else {
            console.log(`- ${field}: not found`);
          }
        });
        
        // Output all top-level keys
        console.log('\nAll top-level keys:');
        console.log(Object.keys(data).join(', '));
      });
    } else {
      console.log('No company documents found.');
    }

    // Now check a sample user to see the company reference
    return db.collection('users').limit(1).get();
  })
  .then(snapshot => {
    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data();
      console.log('\n=== Sample User ===');
      console.log('User ID:', snapshot.docs[0].id);
      console.log('companyId:', userData.companyId);
      console.log('connectedCompanies:', userData.connectedCompanies);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  }); 