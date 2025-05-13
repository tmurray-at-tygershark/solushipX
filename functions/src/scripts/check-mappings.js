const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin with service account
const serviceAccount = require('../../service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Connect to the 'admin' Firestore database
const adminDb = getFirestore(admin.app(), 'admin');

const checkMappings = async () => {
    try {
        console.log('Checking EDI mappings structure...');
        console.log('Using admin database...');

        // List all collections in the database
        console.log('\nAvailable collections:');
        const collections = await adminDb.listCollections();
        console.log(collections.map(col => col.id));

        // Check ediMappings collection
        console.log('\nChecking ediMappings collection...');
        const ediMappingsRef = adminDb.collection('ediMappings');
        const ediMappingsSnapshot = await ediMappingsRef.get();
        
        if (ediMappingsSnapshot.empty) {
            console.log('ediMappings collection is empty');
        } else {
            console.log('Documents in ediMappings:');
            for (const doc of ediMappingsSnapshot.docs) {
                console.log(`\nDocument ID: ${doc.id}`);
                console.log('Data:', JSON.stringify(doc.data(), null, 2));
                
                // Check subcollections
                const subcollections = await doc.ref.listCollections();
                console.log('Subcollections:', subcollections.map(col => col.id));
                
                // Check default subcollection if it exists
                const defaultRef = doc.ref.collection('default');
                const defaultSnapshot = await defaultRef.get();
                if (!defaultSnapshot.empty) {
                    console.log('Documents in default subcollection:');
                    for (const defaultDoc of defaultSnapshot.docs) {
                        console.log(`\nDefault Document ID: ${defaultDoc.id}`);
                        console.log('Data:', JSON.stringify(defaultDoc.data(), null, 2));
                    }
                }
            }
        }

        // Check carriers collection
        console.log('\nChecking carriers collection...');
        const carriersRef = adminDb.collection('carriers');
        const carriersSnapshot = await carriersRef.get();
        
        if (carriersSnapshot.empty) {
            console.log('carriers collection is empty');
        } else {
            console.log('Documents in carriers:');
            for (const doc of carriersSnapshot.docs) {
                console.log(`\nDocument ID: ${doc.id}`);
                console.log('Data:', JSON.stringify(doc.data(), null, 2));
                
                // Check subcollections
                const subcollections = await doc.ref.listCollections();
                console.log('Subcollections:', subcollections.map(col => col.id));
            }
        }

    } catch (error) {
        console.error('Error checking mappings:', error);
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

// Run the check
checkMappings(); 