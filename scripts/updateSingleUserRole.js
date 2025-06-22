const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateUserRole(userEmail) {
    console.log(`Looking for user with email: ${userEmail}`);
    
    try {
        // Find user by email
        const usersSnapshot = await db.collection('users')
            .where('email', '==', userEmail)
            .limit(1)
            .get();
        
        if (usersSnapshot.empty) {
            console.error(`No user found with email: ${userEmail}`);
            process.exit(1);
        }
        
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        
        console.log(`Found user: ${userData.email}`);
        console.log(`Current role: ${userData.role}`);
        
        // Check if role needs updating
        if (userData.role === 'super_admin') {
            console.log('Updating role from super_admin to superadmin...');
            
            await userDoc.ref.update({
                role: 'superadmin',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Successfully updated role to superadmin');
            
            // Also update Firebase Auth custom claims if needed
            try {
                const authUser = await admin.auth().getUserByEmail(userEmail);
                await admin.auth().setCustomUserClaims(authUser.uid, {
                    role: 'superadmin',
                    superadmin: true
                });
                console.log('✅ Updated Firebase Auth custom claims');
            } catch (authError) {
                console.log('Could not update Auth claims:', authError.message);
            }
            
        } else if (userData.role === 'superadmin') {
            console.log('User already has the correct role: superadmin');
        } else {
            console.log(`User has role: ${userData.role} - no update needed`);
        }
        
        // Verify the update
        const updatedDoc = await userDoc.ref.get();
        const updatedData = updatedDoc.data();
        console.log(`\nFinal role: ${updatedData.role}`);
        
    } catch (error) {
        console.error('Error updating user role:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Get email from command line argument
const userEmail = process.argv[2];

if (!userEmail) {
    console.error('Please provide a user email as an argument');
    console.error('Usage: node updateSingleUserRole.js user@example.com');
    process.exit(1);
}

// Run the update
updateUserRole(userEmail); 