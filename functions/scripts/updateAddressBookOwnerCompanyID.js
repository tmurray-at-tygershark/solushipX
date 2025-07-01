const admin = require('../config/admin');
const fs = require('fs');
const path = require('path');

const db = admin.firestore();

async function updateAddressBookOwnerCompanyID() {
    try {
        console.log('🔍 Starting AddressBook ownerCompanyID update script...');
        console.log('📋 Target: Change "APL" → "ICAL"');
        console.log('');
        
        // Step 1: Query all addressbook records with ownerCompanyID = "APL"
        console.log('🔍 Step 1: Finding addressbook records with ownerCompanyID = "APL"...');
        const snapshot = await db.collection('addressBook')
            .where('ownerCompanyID', '==', 'APL')
            .get();
        
        console.log(`📊 Found ${snapshot.size} records with ownerCompanyID = "APL"`);
        
        if (snapshot.empty) {
            console.log('✅ No records found with ownerCompanyID = "APL". Nothing to update.');
            return;
        }
        
        // Step 2: Create backup of records before updating
        console.log('');
        console.log('💾 Step 2: Creating backup of records before updating...');
        const backupData = [];
        const recordsToUpdate = [];
        
        snapshot.forEach(doc => {
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
        
        // Save backup to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `addressbook-apl-backup-${timestamp}.json`;
        const backupPath = path.join(__dirname, backupFileName);
        
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`✅ Backup saved to: ${backupPath}`);
        
        // Step 3: Display records for verification
        console.log('');
        console.log('📋 Step 3: Records to be updated:');
        console.log('----------------------------------------');
        recordsToUpdate.forEach((record, index) => {
            console.log(`${index + 1}. Document ID: ${record.id}`);
            console.log(`   Company: ${record.currentData.companyName || 'N/A'}`);
            console.log(`   Address: ${record.currentData.street || 'N/A'}, ${record.currentData.city || 'N/A'}`);
            console.log(`   Type: ${record.currentData.addressType || 'N/A'}`);
            console.log(`   Current ownerCompanyID: ${record.currentData.ownerCompanyID}`);
            console.log(`   Will change to: ICAL`);
            console.log('');
        });
        
        // Step 4: Confirm before proceeding
        console.log('⚠️  CONFIRMATION REQUIRED ⚠️');
        console.log(`About to update ${recordsToUpdate.length} addressbook records:`);
        console.log(`- Change ownerCompanyID from "APL" to "ICAL"`);
        console.log(`- Backup saved to: ${backupFileName}`);
        console.log('');
        
        // For safety, require manual confirmation by uncommenting the next line
        console.log('🔒 SAFETY CHECK: To proceed, uncomment the UPDATE_CONFIRMED line in the script');
        
        // Uncomment this line to actually run the updates:
        // const UPDATE_CONFIRMED = true;
        
        if (typeof UPDATE_CONFIRMED === 'undefined') {
            console.log('❌ Updates NOT executed - safety check in place');
            console.log('📝 To run the updates:');
            console.log('   1. Review the backup file and records above');
            console.log('   2. Uncomment the "UPDATE_CONFIRMED = true" line in the script');
            console.log('   3. Run the script again');
            return;
        }
        
        // Step 5: Perform the updates
        console.log('');
        console.log('🔄 Step 5: Updating records...');
        
        const batch = db.batch();
        let updateCount = 0;
        
        recordsToUpdate.forEach(record => {
            const docRef = db.collection('addressBook').doc(record.id);
            batch.update(docRef, {
                ownerCompanyID: 'ICAL',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                migrationNote: `Updated from APL to ICAL on ${new Date().toISOString()}`
            });
            updateCount++;
        });
        
        // Execute the batch update
        await batch.commit();
        
        console.log('');
        console.log('✅ SUCCESS! Updates completed:');
        console.log(`📊 Updated ${updateCount} addressbook records`);
        console.log(`🔄 Changed ownerCompanyID from "APL" to "ICAL"`);
        console.log(`💾 Backup available at: ${backupFileName}`);
        console.log('');
        
        // Step 6: Verify updates
        console.log('🔍 Step 6: Verifying updates...');
        const verifySnapshot = await db.collection('addressBook')
            .where('ownerCompanyID', '==', 'ICAL')
            .get();
        
        const aplCheck = await db.collection('addressBook')
            .where('ownerCompanyID', '==', 'APL')
            .get();
        
        console.log(`✅ Records with ownerCompanyID = "ICAL": ${verifySnapshot.size}`);
        console.log(`✅ Records with ownerCompanyID = "APL": ${aplCheck.size}`);
        
        if (aplCheck.size === 0) {
            console.log('🎉 All APL records successfully updated to ICAL!');
        } else {
            console.log('⚠️  Some APL records may still exist - check manually');
        }
        
    } catch (error) {
        console.error('❌ Error updating addressbook records:', error);
        console.log('');
        console.log('🔧 Recovery instructions:');
        console.log('1. Check the backup file created earlier');
        console.log('2. If needed, restore from backup using the reverse script');
        console.log('3. Contact administrator for assistance');
        throw error;
    }
}

// Run the script
if (require.main === module) {
    updateAddressBookOwnerCompanyID()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { updateAddressBookOwnerCompanyID }; 