const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const app = initializeApp();
const db = getFirestore();

async function checkCompanyAndSetupNotifications() {
  try {
    console.log('Checking company IC...');
    
    // Check if company IC exists
    const companyDoc = await db.collection('companies').doc('IC').get();
    
    if (!companyDoc.exists) {
      console.log('Company IC does not exist! This needs to be created first.');
      
      // List all companies to see what exists
      const companiesSnapshot = await db.collection('companies').get();
      console.log('Available companies:');
      companiesSnapshot.docs.forEach(doc => {
        console.log('- Company ID:', doc.id, '- Name:', doc.data()?.companyName || 'No name');
      });
      
      return;
    }
    
    console.log('Company IC exists!');
    const companyData = companyDoc.data();
    console.log('Current company data keys:', Object.keys(companyData));
    
    // Check if notificationSubscriptions exists
    if (!companyData.notificationSubscriptions) {
      console.log('No notificationSubscriptions field found. Need to run migration.');
    } else {
      console.log('NotificationSubscriptions already exists:', companyData.notificationSubscriptions);
    }
    
    // Find users connected to this company
    const usersSnapshot = await db.collection('users')
      .where('connectedCompanies.companies', 'array-contains', 'IC')
      .get();
      
    console.log('Users connected to company IC:', usersSnapshot.docs.length);
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      console.log('- User:', userData.email, '- Notifications:', userData.notifications);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkCompanyAndSetupNotifications(); 