const { initializeApp, cert } = require('firebase-admin/app');
const { getFunctions } = require('firebase-admin/functions');
const { getAuth } = require('firebase-admin/auth');

// Initialize Firebase Admin (reuse existing service account)
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const functions = getFunctions();

async function testDuplicateInvoiceSearch() {
    console.log('🔍 Testing duplicate invoice search...\n');
    
    try {
        // For admin functions, we need to simulate authentication
        // In a real frontend call, this would be handled by Firebase Auth
        const mockAuth = {
            uid: 'test-admin-user',
            token: {
                admin: true,
                email: 'admin@test.com'
            }
        };
        
        // Call the Cloud Function
        const result = await functions.callable('adminFindDuplicateInvoices')();
        
        console.log('📊 DUPLICATE INVOICE SEARCH RESULTS:');
        console.log('=' .repeat(50));
        
        const { statistics, duplicates, summary } = result.data;
        
        // Display statistics
        console.log('\n📈 DATABASE STATISTICS:');
        console.log(`   Total Invoices: ${statistics.totalInvoices}`);
        console.log(`   Unique Invoice Numbers: ${statistics.totalUniqueNumbers}`);
        console.log(`   Invoices Without Numbers: ${statistics.invoicesWithoutNumbers}`);
        console.log(`   Duplicate Numbers Found: ${statistics.totalDuplicateNumbers}`);
        console.log(`   Total Duplicate Invoices: ${statistics.totalDuplicateInvoices}`);
        console.log(`   Largest Duplicate Group: ${statistics.largestDuplicateGroup}`);
        
        // Display summary
        console.log('\n🎯 SUMMARY:');
        console.log(`   ${summary.message}`);
        
        // Display detailed duplicates if any
        if (duplicates && duplicates.length > 0) {
            console.log('\n🚨 DETAILED DUPLICATE INFORMATION:');
            console.log('-'.repeat(50));
            
            duplicates.forEach((duplicate, index) => {
                console.log(`\n${index + 1}. Invoice Number: "${duplicate.invoiceNumber}" (${duplicate.count} copies)`);
                
                duplicate.invoices.forEach((invoice, invoiceIndex) => {
                    console.log(`   ${invoiceIndex + 1}. Document ID: ${invoice.documentId}`);
                    console.log(`      Company: ${invoice.companyName || 'Unknown'}`);
                    console.log(`      Customer: ${invoice.customerName || 'Unknown'}`);
                    console.log(`      Total: ${invoice.currency} ${invoice.total}`);
                    console.log(`      Status: ${invoice.status} / ${invoice.paymentStatus}`);
                    console.log(`      Created: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : 'Unknown'}`);
                    if (invoice.shipmentIds && invoice.shipmentIds.length > 0) {
                        console.log(`      Shipments: ${invoice.shipmentIds.join(', ')}`);
                    }
                    console.log(`      Source: ${invoice.backfillSource || 'Standard'}`);
                    console.log('');
                });
            });
        } else {
            console.log('\n✅ No duplicate invoice numbers found in your database!');
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ Duplicate search completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing duplicate search:', error);
        
        if (error.message) {
            console.error('Error message:', error.message);
        }
        
        if (error.details) {
            console.error('Error details:', error.details);
        }
    }
}

// Run the test
testDuplicateInvoiceSearch().then(() => {
    console.log('\n🏁 Test completed. Exiting...');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
