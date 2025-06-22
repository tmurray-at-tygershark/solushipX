const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateUserRoles() {
    console.log('Starting user role migration...');
    
    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        
        let updateCount = 0;
        const batch = db.batch();
        
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            let needsUpdate = false;
            let updates = {};
            
            // Check if role needs migration
            if (userData.role === 'super_admin') {
                updates.role = 'superadmin';
                needsUpdate = true;
            } else if (userData.role === 'business_admin') {
                updates.role = 'user';
                needsUpdate = true;
            }
            
            // Update if needed
            if (needsUpdate) {
                updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                batch.update(doc.ref, updates);
                updateCount++;
                console.log(`Updating user ${userData.email}: ${userData.role} -> ${updates.role}`);
            }
        }
        
        if (updateCount > 0) {
            await batch.commit();
            console.log(`Successfully migrated ${updateCount} users`);
        } else {
            console.log('No users needed migration');
        }
        
        // Verify migration
        console.log('\nVerifying migration...');
        const verifySnapshot = await db.collection('users').get();
        const roleCounts = {
            superadmin: 0,
            admin: 0,
            user: 0,
            other: 0
        };
        
        verifySnapshot.forEach(doc => {
            const role = doc.data().role;
            if (roleCounts.hasOwnProperty(role)) {
                roleCounts[role]++;
            } else {
                roleCounts.other++;
            }
        });
        
        console.log('Role distribution after migration:');
        console.log(`- Super Admins: ${roleCounts.superadmin}`);
        console.log(`- Admins: ${roleCounts.admin}`);
        console.log(`- Company Admins (users): ${roleCounts.user}`);
        console.log(`- Other/Unknown: ${roleCounts.other}`);
        
    } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run migration
migrateUserRoles(); 