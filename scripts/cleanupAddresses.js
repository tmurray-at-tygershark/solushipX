const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'solushipx'
    });
}

const db = getFirestore();

async function analyzeAddresses() {
    try {
        console.log('🔍 Analyzing all addresses in the addressBook collection...');
        
        // Get all addresses
        const snapshot = await db.collection('addressBook').get();
        
        console.log(`📊 Total addresses found: ${snapshot.docs.length}`);
        
        const addressAnalysis = {
            total: 0,
            byClass: {},
            byType: {},
            companyOrigins: [],
            customerDestinations: [],
            problematicRecords: []
        };
        
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            addressAnalysis.total++;
            
            // Analyze by addressClass
            const addressClass = data.addressClass || 'undefined';
            addressAnalysis.byClass[addressClass] = (addressAnalysis.byClass[addressClass] || 0) + 1;
            
            // Analyze by addressType
            const addressType = data.addressType || 'undefined';
            addressAnalysis.byType[addressType] = (addressAnalysis.byType[addressType] || 0) + 1;
            
            // Categorize addresses
            if (addressClass === 'company' && addressType === 'origin') {
                addressAnalysis.companyOrigins.push({
                    id,
                    nickname: data.nickname,
                    companyName: data.companyName,
                    address1: data.address1,
                    city: data.city,
                    addressClassID: data.addressClassID
                });
            } else if (addressClass === 'customer' && addressType === 'destination') {
                addressAnalysis.customerDestinations.push({
                    id,
                    nickname: data.nickname,
                    companyName: data.companyName,
                    address1: data.address1,
                    city: data.city,
                    addressClassID: data.addressClassID
                });
            } else {
                // These are problematic records
                addressAnalysis.problematicRecords.push({
                    id,
                    addressClass,
                    addressType,
                    nickname: data.nickname,
                    companyName: data.companyName,
                    address1: data.address1,
                    city: data.city,
                    addressClassID: data.addressClassID,
                    status: data.status
                });
            }
        });
        
        // Print analysis
        console.log('\n📈 ADDRESS ANALYSIS RESULTS:');
        console.log('='.repeat(50));
        
        console.log(`\n📊 Total Addresses: ${addressAnalysis.total}`);
        
        console.log('\n🏷️  By Address Class:');
        Object.entries(addressAnalysis.byClass).forEach(([key, count]) => {
            console.log(`   ${key}: ${count}`);
        });
        
        console.log('\n🎯 By Address Type:');
        Object.entries(addressAnalysis.byType).forEach(([key, count]) => {
            console.log(`   ${key}: ${count}`);
        });
        
        console.log(`\n✅ Valid Company Origins: ${addressAnalysis.companyOrigins.length}`);
        addressAnalysis.companyOrigins.forEach(addr => {
            console.log(`   - ${addr.nickname || 'No nickname'} (${addr.companyName}) - ${addr.city}`);
        });
        
        console.log(`\n✅ Valid Customer Destinations: ${addressAnalysis.customerDestinations.length}`);
        addressAnalysis.customerDestinations.slice(0, 10).forEach(addr => {
            console.log(`   - ${addr.nickname || 'No nickname'} (${addr.companyName}) - ${addr.city}`);
        });
        if (addressAnalysis.customerDestinations.length > 10) {
            console.log(`   ... and ${addressAnalysis.customerDestinations.length - 10} more`);
        }
        
        if (addressAnalysis.problematicRecords.length > 0) {
            console.log(`\n⚠️  PROBLEMATIC RECORDS: ${addressAnalysis.problematicRecords.length}`);
            console.log('These addresses have incorrect addressClass/addressType combinations:');
            addressAnalysis.problematicRecords.forEach(addr => {
                console.log(`   - ID: ${addr.id}`);
                console.log(`     Class: ${addr.addressClass}, Type: ${addr.addressType}`);
                console.log(`     Company: ${addr.companyName || 'N/A'}`);
                console.log(`     Address: ${addr.address1 || 'N/A'}, ${addr.city || 'N/A'}`);
                console.log(`     ClassID: ${addr.addressClassID || 'N/A'}`);
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ Error analyzing addresses:', error);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'analyze') {
        await analyzeAddresses();
    } else {
        console.log('Usage:');
        console.log('  node scripts/cleanupAddresses.js analyze    - Analyze all addresses');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { analyzeAddresses }; 