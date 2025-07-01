const { initializeApp } = require('firebase/app');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
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
const functions = getFunctions(app);

async function testAddressBookUpdate() {
    try {
        console.log('🧪 Testing AddressBook update function...');
        console.log('');
        
        // Step 1: First call without confirmation to see what records will be affected
        console.log('📋 Step 1: Getting preview of records to be updated...');
        const updateFunction = httpsCallable(functions, 'updateAddressBookOwnerCompanyID');
        
        const previewResult = await updateFunction({});
        
        console.log('📊 Preview Result:');
        console.log(`- Records found: ${previewResult.data.recordsFound}`);
        console.log(`- Success: ${previewResult.data.success}`);
        console.log(`- Message: ${previewResult.data.message}`);
        
        if (previewResult.data.recordsToUpdate) {
            console.log('');
            console.log('📋 Records that will be updated:');
            previewResult.data.recordsToUpdate.forEach((record, index) => {
                console.log(`${index + 1}. Document ID: ${record.id}`);
                console.log(`   Company: ${record.companyName || 'N/A'}`);
                console.log(`   Address: ${record.address}`);
                console.log(`   Type: ${record.type || 'N/A'}`);
                console.log(`   Current ownerCompanyID: ${record.currentOwnerCompanyID}`);
                console.log('');
            });
        }
        
        if (previewResult.data.recordsFound === 0) {
            console.log('✅ No records found with ownerCompanyID = "APL". Nothing to update.');
            return;
        }
        
        // Step 2: Ask for confirmation
        console.log('⚠️  CONFIRMATION REQUIRED ⚠️');
        console.log(`About to update ${previewResult.data.recordsFound} addressbook records:`);
        console.log(`- Change ownerCompanyID from "APL" to "ICAL"`);
        console.log('');
        console.log('🔒 To proceed with the actual update, run this script again with CONFIRMED=true');
        console.log('   Example: CONFIRMED=true node testAddressBookUpdate.js');
        console.log('');
        
        // Check if user confirmed
        if (process.env.CONFIRMED === 'true') {
            console.log('✅ Confirmation received. Proceeding with update...');
            console.log('');
            
            // Step 3: Call with confirmation to actually update
            const updateResult = await updateFunction({ confirmed: true });
            
            console.log('🎉 Update Result:');
            console.log(`- Success: ${updateResult.data.success}`);
            console.log(`- Message: ${updateResult.data.message}`);
            console.log(`- Records found: ${updateResult.data.recordsFound}`);
            console.log(`- Records updated: ${updateResult.data.recordsUpdated}`);
            
            if (updateResult.data.verificationResults) {
                console.log(`- ICAL records after update: ${updateResult.data.verificationResults.icalRecords}`);
                console.log(`- Remaining APL records: ${updateResult.data.verificationResults.remainingAplRecords}`);
            }
            
            if (updateResult.data.success) {
                console.log('');
                console.log('🎉 SUCCESS! All APL records have been updated to ICAL!');
                
                // Save backup data to file
                if (updateResult.data.backupData) {
                    const fs = require('fs');
                    const path = require('path');
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const backupFileName = `addressbook-apl-to-ical-backup-${timestamp}.json`;
                    const backupPath = path.join(__dirname, backupFileName);
                    
                    fs.writeFileSync(backupPath, JSON.stringify(updateResult.data.backupData, null, 2));
                    console.log(`💾 Backup saved locally to: ${backupFileName}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing address book update:', error);
        
        if (error.code) {
            console.error(`Error code: ${error.code}`);
        }
        if (error.message) {
            console.error(`Error message: ${error.message}`);
        }
    }
}

// Run the test
testAddressBookUpdate(); 