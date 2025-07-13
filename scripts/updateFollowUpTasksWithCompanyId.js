const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://solushipx-default-rtdb.firebaseio.com/'
});

const db = admin.firestore();

async function updateFollowUpTasksWithCompanyId() {
    try {
        console.log('🔄 Starting follow-up tasks company ID update...');

        // Get all follow-up tasks
        const tasksSnapshot = await db.collection('followUpTasks').get();
        console.log(`📋 Found ${tasksSnapshot.docs.length} follow-up tasks`);

        let updated = 0;
        let errors = 0;

        for (const taskDoc of tasksSnapshot.docs) {
            const taskData = taskDoc.data();
            
            // Skip if already has companyId
            if (taskData.companyId) {
                continue;
            }

            try {
                // Find the associated shipment
                const shipmentId = taskData.shipmentId;
                if (!shipmentId) {
                    console.log(`⚠️  Task ${taskDoc.id} has no shipmentId`);
                    continue;
                }

                // Try to find shipment in shipments collection
                const shipmentQuery = await db.collection('shipments')
                    .where('shipmentID', '==', shipmentId)
                    .limit(1)
                    .get();

                let companyId = null;
                let customerId = null;

                if (!shipmentQuery.empty) {
                    const shipmentData = shipmentQuery.docs[0].data();
                    companyId = shipmentData.companyID;
                    customerId = shipmentData.customerId;
                } else {
                    // Try to find in shipment documents by document ID
                    const shipmentDocQuery = await db.collection('shipments').doc(shipmentId).get();
                    if (shipmentDocQuery.exists) {
                        const shipmentData = shipmentDocQuery.data();
                        companyId = shipmentData.companyID;
                        customerId = shipmentData.customerId;
                    }
                }

                if (companyId) {
                    // Update the task with companyId
                    await db.collection('followUpTasks').doc(taskDoc.id).update({
                        companyId: companyId,
                        customerId: customerId || null,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    console.log(`✅ Updated task ${taskDoc.id} with companyId: ${companyId}`);
                    updated++;
                } else {
                    console.log(`⚠️  Could not find shipment for task ${taskDoc.id} (shipmentId: ${shipmentId})`);
                }

            } catch (error) {
                console.error(`❌ Error updating task ${taskDoc.id}:`, error);
                errors++;
            }
        }

        console.log(`\n🎉 Update complete!`);
        console.log(`✅ Updated: ${updated} tasks`);
        console.log(`❌ Errors: ${errors} tasks`);

    } catch (error) {
        console.error('❌ Error updating follow-up tasks:', error);
    } finally {
        process.exit(0);
    }
}

// Run the update
updateFollowUpTasksWithCompanyId(); 