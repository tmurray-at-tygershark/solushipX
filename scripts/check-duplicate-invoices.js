const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInWithCustomToken } = require('firebase/auth');

// Firebase config (using your project)
const firebaseConfig = {
    projectId: 'solushipx',
    authDomain: 'solushipx.firebaseapp.com',
    storageBucket: 'solushipx.firebasestorage.app'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

async function checkDuplicateInvoices() {
    console.log('🔍 Searching for duplicate invoice numbers in your database...\n');
    
    try {
        // Get the callable function
        const findDuplicates = httpsCallable(functions, 'adminFindDuplicateInvoices');
        
        // Call the function
        console.log('📡 Calling Cloud Function...');
        const result = await findDuplicates();
        
        const { statistics, duplicates, summary } = result.data;
        
        console.log('\n📊 INVOICE DATABASE ANALYSIS:');
        console.log('=' .repeat(60));
        
        // Display statistics
        console.log('\n📈 STATISTICS:');
        console.log(`   📄 Total Invoices in Database: ${statistics.totalInvoices.toLocaleString()}`);
        console.log(`   🔢 Unique Invoice Numbers: ${statistics.totalUniqueNumbers.toLocaleString()}`);
        console.log(`   ❓ Invoices Without Numbers: ${statistics.invoicesWithoutNumbers.toLocaleString()}`);
        console.log(`   ⚠️  Duplicate Numbers Found: ${statistics.totalDuplicateNumbers.toLocaleString()}`);
        console.log(`   🔄 Total Affected Invoices: ${statistics.totalDuplicateInvoices.toLocaleString()}`);
        console.log(`   📊 Largest Duplicate Group: ${statistics.largestDuplicateGroup}`);
        
        // Display summary
        console.log('\n🎯 RESULT:');
        console.log(`   ${summary.message}`);
        
        // Display detailed duplicates if any
        if (duplicates && duplicates.length > 0) {
            console.log('\n🚨 DUPLICATE INVOICE DETAILS:');
            console.log('─'.repeat(60));
            
            duplicates.forEach((duplicate, index) => {
                console.log(`\n${index + 1}. 📋 Invoice Number: "${duplicate.invoiceNumber}"`);
                console.log(`   🔢 Duplicate Count: ${duplicate.count} copies`);
                console.log('   📝 Details:');
                
                duplicate.invoices.forEach((invoice, invoiceIndex) => {
                    const createdDate = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : 'Unknown';
                    const total = invoice.total ? `${invoice.currency} ${parseFloat(invoice.total).toFixed(2)}` : 'N/A';
                    
                    console.log(`      ${invoiceIndex + 1}. ID: ${invoice.documentId}`);
                    console.log(`         🏢 Company: ${invoice.companyName || 'Unknown'}`);
                    console.log(`         👤 Customer: ${invoice.customerName || 'Unknown'}`);
                    console.log(`         💰 Total: ${total}`);
                    console.log(`         📊 Status: ${invoice.status}${invoice.paymentStatus !== invoice.status ? ` / ${invoice.paymentStatus}` : ''}`);
                    console.log(`         📅 Created: ${createdDate}`);
                    
                    if (invoice.shipmentIds && invoice.shipmentIds.length > 0) {
                        console.log(`         📦 Shipments: ${invoice.shipmentIds.length} linked`);
                    }
                    
                    if (invoice.backfillSource) {
                        console.log(`         🔄 Source: ${invoice.backfillSource}`);
                    }
                    
                    console.log('');
                });
                
                if (index < duplicates.length - 1) {
                    console.log('   ' + '─'.repeat(40));
                }
            });
            
            console.log('\n💡 RECOMMENDATIONS:');
            console.log('   • Review these duplicates to determine which invoices to keep');
            console.log('   • Check if duplicates represent different billing periods');
            console.log('   • Consider updating invoice numbering processes to prevent future duplicates');
            console.log('   • Verify shipment associations are correct');
            
        } else {
            console.log('\n✅ EXCELLENT! No duplicate invoice numbers found!');
            console.log('   Your invoice numbering system is working correctly.');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Analysis completed successfully!');
        
        return {
            hasDuplicates: duplicates && duplicates.length > 0,
            duplicateCount: duplicates ? duplicates.length : 0,
            totalAffectedInvoices: statistics.totalDuplicateInvoices,
            statistics: statistics
        };
        
    } catch (error) {
        console.error('\n❌ ERROR SEARCHING FOR DUPLICATES:');
        console.error('   Message:', error.message);
        
        if (error.code) {
            console.error('   Code:', error.code);
        }
        
        if (error.details) {
            console.error('   Details:', error.details);
        }
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('   • Make sure you have admin permissions');
        console.log('   • Check your internet connection');
        console.log('   • Verify the Cloud Function was deployed successfully');
        
        throw error;
    }
}

// Run the analysis
if (require.main === module) {
    console.log('🔍 SOLUSHIPX DUPLICATE INVOICE CHECKER');
    console.log('=====================================\n');
    
    checkDuplicateInvoices()
        .then((results) => {
            console.log('\n🏁 Analysis complete!');
            
            if (results.hasDuplicates) {
                console.log(`⚠️  Found ${results.duplicateCount} duplicate invoice numbers affecting ${results.totalAffectedInvoices} invoices.`);
                process.exit(1); // Exit with error code if duplicates found
            } else {
                console.log('✅ No duplicates found - your system is clean!');
                process.exit(0);
            }
        })
        .catch((error) => {
            console.error('\n💥 Analysis failed:', error.message);
            process.exit(1);
        });
}

module.exports = { checkDuplicateInvoices };
