const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('../../service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Connect to the 'admin' Firestore database
const adminDb = getFirestore(admin.app(), 'admin');

const migrateEDIMappings = async () => {
    try {
        console.log('Starting EDI mappings migration...');
        console.log('Using admin database...');

        // List all collections in the database
        console.log('Listing all collections...');
        const collections = await adminDb.listCollections();
        console.log('Available collections:', collections.map(col => col.id));

        // Define the mappings to migrate
        const mappingsToMigrate = [
            { id: 'fedex_text_csv_57fd250aa2849f85a26b563b446a0848', carrierId: 'fedex' },
            { id: 'canpar_text_csv_50cdd1ee97252be8de438eac5c3777da', carrierId: 'canpar' }
        ];

        for (const mapping of mappingsToMigrate) {
            const specificDocRef = adminDb.collection('ediMappings').doc(mapping.id);
            console.log(`Attempting to fetch document: ${mapping.id}`);
            
            const specificDoc = await specificDocRef.get();
            if (specificDoc.exists) {
                console.log(`--- Found Document: ${mapping.id} ---`);
                const mappingData = specificDoc.data();
                console.log('Document Data:', JSON.stringify(mappingData, null, 2));
                console.log('--- End of Document ---');

                // Backup the mapping data to a local JSON file
                const backupDir = path.join(__dirname, 'backups');
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                const backupPath = path.join(backupDir, `${mapping.id}_backup.json`);
                fs.writeFileSync(backupPath, JSON.stringify(mappingData, null, 2));
                console.log(`Backup saved to: ${backupPath}`);

                // Migrate the mapping to the new structure under ediMappings/{carrierId}/default
                const targetRef = adminDb.collection('ediMappings').doc(mapping.carrierId).collection('default').doc('mapping');
                console.log(`Migrating mapping for ${mapping.carrierId} to ediMappings/${mapping.carrierId}/default/mapping`);
                await targetRef.set(mappingData);
                console.log(`Successfully migrated mapping for ${mapping.carrierId}`);

                // Verify the new mapping was written correctly
                const newMappingDoc = await targetRef.get();
                if (newMappingDoc.exists) {
                    console.log('New mapping verified successfully.');
                    // Only delete the old mapping after confirming the new one is written
                    await specificDocRef.delete();
                    console.log(`Old mapping for ${mapping.carrierId} deleted.`);
                } else {
                    console.error('New mapping was not written correctly. Aborting deletion of old mapping.');
                }
            } else {
                console.log(`Document not found: ${mapping.id}`);
            }
        }

    } catch (error) {
        console.error('Error during migration:', error);
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

// Run the migration
migrateEDIMappings(); 