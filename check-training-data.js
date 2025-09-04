const admin = require('firebase-admin');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'solushipx'
    });
}

const db = admin.firestore();

async function checkTrainingData() {
    console.log('🔍 Checking Landliner training data...\n');

    try {
        // Check unifiedTraining collection
        const unifiedQuery = await db.collection('unifiedTraining')
            .doc('landliner')
            .collection('samples')
            .get();

        console.log(`📊 unifiedTraining/landliner/samples: ${unifiedQuery.size} documents`);

        if (!unifiedQuery.empty) {
            unifiedQuery.docs.forEach((doc, index) => {
                const data = doc.data();
                console.log(`  Sample ${index + 1} (${doc.id}):`);
                console.log(`    - trainingType: ${data.trainingType}`);
                console.log(`    - processingStatus: ${data.processingStatus}`);
                console.log(`    - fileName: ${data.fileName}`);
                console.log(`    - timestamps: ${data.timestamps ? 'Yes' : 'No'}`);
                console.log(`    - visualAnnotations: ${data.visualAnnotations ? 'Yes' : 'No'}`);
                console.log('');
            });
        }

        // Also check if there's data in other possible locations
        console.log('🔍 Checking other possible locations...\n');

        // Check trainingExamples
        const trainingExamplesQuery = await db.collection('trainingExamples')
            .where('carrierId', '==', 'landliner')
            .get();

        console.log(`📊 trainingExamples: ${trainingExamplesQuery.size} documents`);

        // Check carrierTraining
        const carrierTrainingQuery = await db.collection('carrierTraining')
            .doc('landliner')
            .get();

        console.log(`�� carrierTraining/landliner: ${carrierTrainingQuery.exists ? 'EXISTS' : 'NOT FOUND'}`);

        // Check trainingCarriers
        const trainingCarriersQuery = await db.collection('trainingCarriers')
            .where('id', '==', 'landliner')
            .get();

        console.log(`📊 trainingCarriers: ${trainingCarriersQuery.size} documents`);

        if (!trainingCarriersQuery.empty) {
            const carrierData = trainingCarriersQuery.docs[0].data();
            console.log(`    - name: ${carrierData.name}`);
            console.log(`    - status: ${carrierData.status}`);
        }

    } catch (error) {
        console.error('❌ Error checking training data:', error);
    }
}

checkTrainingData().then(() => {
    console.log('✅ Training data check complete');
    process.exit(0);
}).catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
});
