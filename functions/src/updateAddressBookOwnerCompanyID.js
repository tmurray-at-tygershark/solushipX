const { onCall } = require('firebase-functions/v2/https');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Cloud function to update addressbook records from APL to ICAL
 * Updates BOTH companyID and ownerCompanyID fields
 * Call with: firebase functions:shell, then updateAddressBookOwnerCompanyID({})
 */
const updateAddressBookOwnerCompanyID = onCall(async (request) => {
    try {
        logger.info('🔍 Starting AddressBook migration: APL → ICAL');
        logger.info('📋 Will update BOTH companyID AND ownerCompanyID fields');
        
        // Step 1: Query all addressbook records with companyID = "APL" OR ownerCompanyID = "APL"
        logger.info('🔍 Step 1: Finding addressbook records with companyID = "APL" or ownerCompanyID = "APL"...');
        
        // Query 1: companyID = "APL"
        const snapshot1 = await db.collection('addressBook')
            .where('companyID', '==', 'APL')
            .get();
        
        // Query 2: ownerCompanyID = "APL"
        const snapshot2 = await db.collection('addressBook')
            .where('ownerCompanyID', '==', 'APL')
            .get();
        
        // Combine results and deduplicate
        const allRecords = new Map();
        
        snapshot1.forEach(doc => {
            allRecords.set(doc.id, doc);
        });
        
        snapshot2.forEach(doc => {
            allRecords.set(doc.id, doc);
        });
        
        logger.info(`📊 Found ${snapshot1.size} records with companyID = "APL"`);
        logger.info(`📊 Found ${snapshot2.size} records with ownerCompanyID = "APL"`);
        logger.info(`📊 Total unique records to update: ${allRecords.size}`);
        
        if (allRecords.size === 0) {
            logger.info('✅ No records found with APL in companyID or ownerCompanyID. Nothing to update.');
            return {
                success: true,
                message: 'No records found with APL in companyID or ownerCompanyID. Nothing to update.',
                recordsFound: 0,
                recordsUpdated: 0
            };
        }
        
        // Step 2: Prepare records for update
        logger.info('💾 Step 2: Preparing records for update...');
        const recordsToUpdate = [];
        const backupData = [];
        
        allRecords.forEach(doc => {
            const data = doc.data();
            backupData.push({
                id: doc.id,
                data: data
            });
            recordsToUpdate.push({
                id: doc.id,
                currentData: data
            });
        });
        
        // Step 3: Display records for verification
        logger.info('📋 Step 3: Records to be updated:');
        recordsToUpdate.forEach((record, index) => {
            logger.info(`${index + 1}. Document ID: ${record.id}`);
            logger.info(`   Company: ${record.currentData.companyName || 'N/A'}`);
            logger.info(`   Address: ${record.currentData.street || 'N/A'}, ${record.currentData.city || 'N/A'}`);
            logger.info(`   Type: ${record.currentData.addressType || 'N/A'}`);
            logger.info(`   Current companyID: ${record.currentData.companyID || 'N/A'}`);
            logger.info(`   Current ownerCompanyID: ${record.currentData.ownerCompanyID || 'N/A'}`);
            logger.info(`   Will update companyID to: ICAL`);
            logger.info(`   Will update ownerCompanyID to: ICAL`);
        });
        
        // Check if confirmation is provided
        const confirmed = request.data?.confirmed === true;
        
        if (!confirmed) {
            logger.info('⚠️  CONFIRMATION REQUIRED ⚠️');
            logger.info(`About to update ${recordsToUpdate.length} addressbook records:`);
            logger.info(`- Change companyID from "APL" to "ICAL"`);
            logger.info(`- Change ownerCompanyID from "APL" to "ICAL"`);
            
            return {
                success: false,
                message: 'Confirmation required. Call again with { confirmed: true } to proceed.',
                recordsFound: recordsToUpdate.length,
                recordsToUpdate: recordsToUpdate.map(r => ({
                    id: r.id,
                    companyName: r.currentData.companyName,
                    address: `${r.currentData.street || 'N/A'}, ${r.currentData.city || 'N/A'}`,
                    type: r.currentData.addressType,
                    currentCompanyID: r.currentData.companyID,
                    currentOwnerCompanyID: r.currentData.ownerCompanyID
                })),
                backupData: backupData
            };
        }
        
        // Step 4: Perform the updates
        logger.info('🔄 Step 4: Updating records...');
        
        const batch = db.batch();
        let updateCount = 0;
        
        recordsToUpdate.forEach(record => {
            const docRef = db.collection('addressBook').doc(record.id);
            
            // Update both companyID and ownerCompanyID to ICAL
            const updateData = {
                companyID: 'ICAL',
                ownerCompanyID: 'ICAL',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                migrationNote: `Updated from APL to ICAL on ${new Date().toISOString()}`
            };
            
            batch.update(docRef, updateData);
            updateCount++;
        });
        
        // Execute the batch update
        await batch.commit();
        
        logger.info('✅ SUCCESS! Updates completed:');
        logger.info(`📊 Updated ${updateCount} addressbook records`);
        logger.info(`🔄 Changed companyID from "APL" to "ICAL"`);
        logger.info(`🔄 Changed ownerCompanyID from "APL" to "ICAL"`);
        
        // Step 5: Verify updates
        logger.info('🔍 Step 5: Verifying updates...');
        
        const verifyCompanySnapshot = await db.collection('addressBook')
            .where('companyID', '==', 'ICAL')
            .get();
        
        const verifyOwnerSnapshot = await db.collection('addressBook')
            .where('ownerCompanyID', '==', 'ICAL')
            .get();
        
        const aplCompanyCheck = await db.collection('addressBook')
            .where('companyID', '==', 'APL')
            .get();
        
        const aplOwnerCheck = await db.collection('addressBook')
            .where('ownerCompanyID', '==', 'APL')
            .get();
        
        logger.info(`✅ Records with companyID = "ICAL": ${verifyCompanySnapshot.size}`);
        logger.info(`✅ Records with ownerCompanyID = "ICAL": ${verifyOwnerSnapshot.size}`);
        logger.info(`✅ Records with companyID = "APL": ${aplCompanyCheck.size}`);
        logger.info(`✅ Records with ownerCompanyID = "APL": ${aplOwnerCheck.size}`);
        
        if (aplCompanyCheck.size === 0 && aplOwnerCheck.size === 0) {
            logger.info('🎉 All APL records successfully updated to ICAL!');
        } else {
            logger.warn('⚠️  Some APL records may still exist - check manually');
        }
        
        return {
            success: true,
            message: 'AddressBook records updated successfully - both companyID and ownerCompanyID migrated',
            recordsFound: recordsToUpdate.length,
            recordsUpdated: updateCount,
            verificationResults: {
                companyID_ICAL: verifyCompanySnapshot.size,
                ownerCompanyID_ICAL: verifyOwnerSnapshot.size,
                companyID_APL_remaining: aplCompanyCheck.size,
                ownerCompanyID_APL_remaining: aplOwnerCheck.size
            },
            backupData: backupData
        };
        
    } catch (error) {
        logger.error('❌ Error updating addressbook records:', error);
        return {
            success: false,
            error: error.message,
            message: 'Error updating addressbook records'
        };
    }
});

module.exports = {
    updateAddressBookOwnerCompanyID
}; 