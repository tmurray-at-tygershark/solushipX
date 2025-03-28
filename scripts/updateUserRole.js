const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, '..', 'solushipx-firebase-adminsdk-fbsvc-d7f5dccc04.json'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateUserRole() {
  try {
    const userId = 'Z448UPMB89S8yaNQZecLOeWIzvD3';
    const userRef = db.collection('users').doc(userId);
    
    // Get the current user data first
    const userDoc = await userRef.get();
    const currentData = userDoc.data() || {};
    
    // Update the user document with admin role while preserving other fields
    await userRef.set({
      ...currentData,
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('User role updated successfully to admin!');
  } catch (error) {
    console.error('Error updating user role:', error);
  } finally {
    process.exit();
  }
}

updateUserRole(); 