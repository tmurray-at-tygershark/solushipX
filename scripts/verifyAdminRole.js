const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyAdminRole() {
  try {
    const userId = 'Z448UPMB89S8yaNQZecLOeWIzvD3';
    const userRef = db.collection('users').doc(userId);
    
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('User document not found!');
      return;
    }

    const userData = userDoc.data();
    console.log('User Data:');
    console.log('------------------');
    console.log('Role:', userData.role);
    console.log('Email:', userData.email);
    console.log('Last Updated:', userData.updatedAt ? userData.updatedAt.toDate() : 'N/A');
    
    if (userData.role === 'admin') {
      console.log('\n✅ Confirmed: User has admin privileges');
    } else {
      console.log('\n❌ Warning: User does not have admin role');
      console.log('Current role:', userData.role);
    }

  } catch (error) {
    console.error('Error verifying admin role:', error);
  } finally {
    process.exit();
  }
}

verifyAdminRole(); 