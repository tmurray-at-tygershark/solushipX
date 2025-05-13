const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs').promises;
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('../../service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Connect to the 'admin' Firestore database
const adminDb = getFirestore(admin.app(), 'admin');

const restoreMappings = async () => {
    try {
        console.log('Starting EDI mappings restoration...');
        console.log('Using admin database...');

        // Define the mappings to restore
        const mappings = [
            {
                carrierId: 'fedex',
                backupFile: 'fedex_text_csv_57fd250aa2849f85a26b563b446a0848_backup.json'
            },
            {
                carrierId: 'canpar',
                backupFile: 'canpar_text_csv_50cdd1ee97252be8de438eac5c3777da_backup.json'
            }
        ];

        for (const mapping of mappings) {
            console.log(`\nProcessing ${mapping.carrierId} mapping...`);
            
            // Read the backup file
            const backupPath = path.join(__dirname, 'backups', mapping.backupFile);
            const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
            
            // Create the carrier document if it doesn't exist
            const carrierRef = adminDb.collection('ediMappings').doc(mapping.carrierId);
            await carrierRef.set({
                name: mapping.carrierId.charAt(0).toUpperCase() + mapping.carrierId.slice(1),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Add the mapping to the default subcollection
            const mappingRef = carrierRef.collection('default').doc('mapping');
            await mappingRef.set({
                ...backupData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`Successfully restored ${mapping.carrierId} mapping to ediMappings/${mapping.carrierId}/default/mapping`);
        }

        console.log('\nRestoration completed successfully!');

    } catch (error) {
        console.error('Error restoring mappings:', error);
        console.error('Error details:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    } finally {
        process.exit();
    }
};

// Run the restoration
restoreMappings(); 