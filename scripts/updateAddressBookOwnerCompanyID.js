const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, writeBatch, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateAddressBookOwnerCompanyID() {
    try {
        console.log('🔍 Starting AddressBook migration script...');
        console.log('📋 Target: Change "APL" → "ICAL"');
        console.log('🔄 Will update BOTH companyID AND ownerCompanyID fields');
        console.log('');
        
        // Step 1: Query all addressbook records with companyID = "APL" OR ownerCompanyID = "APL"
        console.log('🔍 Step 1: Finding addressbook records with companyID = "APL" or ownerCompanyID = "APL"...');
        
        // First query: companyID = "APL"
        const q1 = query(collection(db, 'addressBook'), where('companyID', '==', 'APL'));
        const snapshot1 = await getDocs(q1);
        
        // Second query: ownerCompanyID = "APL"
        const q2 = query(collection(db, 'addressBook'), where('ownerCompanyID', '==', 'APL'));
        const snapshot2 = await getDocs(q2);
        
        // Combine results and deduplicate
        const allRecords = new Map();
        
        snapshot1.forEach(doc => {
            allRecords.set(doc.id, doc);
        });
        
        snapshot2.forEach(doc => {
            allRecords.set(doc.id, doc);
        });
        
        console.log(`📊 Found ${snapshot1.size} records with companyID = "APL"`);
        console.log(`📊 Found ${snapshot2.size} records with ownerCompanyID = "APL"`);
        console.log(`📊 Total unique records to update: ${allRecords.size}`);
        
        if (allRecords.size === 0) {
            console.log('✅ No records found with APL in companyID or ownerCompanyID. Nothing to update.');
            return;
        }
        
        // Step 2: Create backup of records before updating
        console.log('');
        console.log('💾 Step 2: Creating backup of records before updating...');
        const backupData = [];
        const recordsToUpdate = [];
        
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
        
        // Save backup to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `addressbook-apl-to-ical-backup-${timestamp}.json`;
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
            console.log(`   Current companyID: ${record.currentData.companyID || 'N/A'}`);
            console.log(`   Current ownerCompanyID: ${record.currentData.ownerCompanyID || 'N/A'}`);
            console.log(`   Will update companyID to: ICAL`);
            console.log(`   Will update ownerCompanyID to: ICAL`);
            console.log('');
        });
        
        // Step 4: Confirm before proceeding
        console.log('⚠️  CONFIRMATION REQUIRED ⚠️');
        console.log(`About to update ${recordsToUpdate.length} addressbook records:`);
        console.log(`- Change companyID from "APL" to "ICAL"`);
        console.log(`- Change ownerCompanyID from "APL" to "ICAL"`);
        console.log(`- Backup saved to: ${backupFileName}`);
        console.log('');
        
        // For safety, require manual confirmation by uncommenting the next line
        console.log('🔒 SAFETY CHECK: To proceed, uncomment the UPDATE_CONFIRMED line in the script');
        
        // Uncomment this line to actually run the updates:
        const UPDATE_CONFIRMED = true;
        
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
        
        const batch = writeBatch(db);
        let updateCount = 0;
        
        recordsToUpdate.forEach(record => {
            const docRef = doc(db, 'addressBook', record.id);
            
            // Prepare update data - always update both fields to ICAL
            const updateData = {
                companyID: 'ICAL',
                ownerCompanyID: 'ICAL',
                updatedAt: serverTimestamp(),
                migrationNote: `Updated from APL to ICAL on ${new Date().toISOString()}`
            };
            
            batch.update(docRef, updateData);
            updateCount++;
        });
        
        // Execute the batch update
        await batch.commit();
        
        console.log('');
        console.log('✅ SUCCESS! Updates completed:');
        console.log(`📊 Updated ${updateCount} addressbook records`);
        console.log(`🔄 Changed companyID from "APL" to "ICAL"`);
        console.log(`🔄 Changed ownerCompanyID from "APL" to "ICAL"`);
        console.log(`💾 Backup available at: ${backupFileName}`);
        console.log('');
        
        // Step 6: Verify updates
        console.log('🔍 Step 6: Verifying updates...');
        const verifyCompanyQuery = query(collection(db, 'addressBook'), where('companyID', '==', 'ICAL'));
        const verifyCompanySnapshot = await getDocs(verifyCompanyQuery);
        
        const verifyOwnerQuery = query(collection(db, 'addressBook'), where('ownerCompanyID', '==', 'ICAL'));
        const verifyOwnerSnapshot = await getDocs(verifyOwnerQuery);
        
        const aplCompanyQuery = query(collection(db, 'addressBook'), where('companyID', '==', 'APL'));
        const aplCompanyCheck = await getDocs(aplCompanyQuery);
        
        const aplOwnerQuery = query(collection(db, 'addressBook'), where('ownerCompanyID', '==', 'APL'));
        const aplOwnerCheck = await getDocs(aplOwnerQuery);
        
        console.log(`✅ Records with companyID = "ICAL": ${verifyCompanySnapshot.size}`);
        console.log(`✅ Records with ownerCompanyID = "ICAL": ${verifyOwnerSnapshot.size}`);
        console.log(`✅ Records with companyID = "APL": ${aplCompanyCheck.size}`);
        console.log(`✅ Records with ownerCompanyID = "APL": ${aplOwnerCheck.size}`);
        
        if (aplCompanyCheck.size === 0 && aplOwnerCheck.size === 0) {
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