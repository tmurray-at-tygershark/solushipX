const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUserRole() {
    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        
        console.log('Checking all users:');
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            console.log(`User: ${userData.email}`);
            console.log(`Role: ${userData.role}`);
            console.log('-------------------');
        });
    } catch (error) {
        console.error('Error checking user role:', error);
    } finally {
        process.exit(0);
    }
}

checkUserRole(); 