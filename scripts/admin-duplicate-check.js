const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function findDuplicateInvoices() {
    console.log('🔍 SOLUSHIPX DUPLICATE INVOICE CHECKER');
    console.log('=====================================\n');
    console.log('📡 Connecting to Firestore...');
    
    try {
        // Query all invoices from the collection
        const invoicesSnapshot = await db.collection('invoices').get();
        
        console.log(`📊 Found ${invoicesSnapshot.size} total invoices to analyze\n`);
        
        // Group invoices by invoice number
        const invoiceGroups = {};
        const allInvoices = [];
        
        invoicesSnapshot.forEach(doc => {
            const data = doc.data();
            const invoiceNumber = data.invoiceNumber;
            
            // Track all invoices for statistics
            allInvoices.push({
                id: doc.id,
                invoiceNumber,
                ...data
            });
            
            // Only process invoices that have an invoice number
            if (invoiceNumber) {
                if (!invoiceGroups[invoiceNumber]) {
                    invoiceGroups[invoiceNumber] = [];
                }
                
                invoiceGroups[invoiceNumber].push({
                    documentId: doc.id,
                    invoiceNumber,
                    companyId: data.companyId || null,
                    companyName: data.companyName || '',
                    customerId: data.customerId || null,
                    customerName: data.customerName || '',
                    total: data.total || 0,
                    currency: data.currency || 'N/A',
                    status: data.status || 'unknown',
                    paymentStatus: data.paymentStatus || 'unknown',
                    issueDate: data.issueDate?.toDate?.() || data.issueDate || null,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
                    shipmentIds: data.shipmentIds || [],
                    backfillSource: data.backfillSource || null
                });
            }
        });
        
        // Find duplicates (groups with more than 1 invoice)
        const duplicates = [];
        const duplicateNumbers = [];
        
        Object.entries(invoiceGroups).forEach(([invoiceNumber, invoices]) => {
            if (invoices.length > 1) {
                duplicateNumbers.push(invoiceNumber);
                duplicates.push({
                    invoiceNumber,
                    count: invoices.length,
                    invoices: invoices.sort((a, b) => {
                        // Sort by creation date (newest first)
                        const dateA = a.createdAt || new Date(0);
                        const dateB = b.createdAt || new Date(0);
                        return dateB - dateA;
                    })
                });
            }
        });
        
        // Sort duplicates by count (highest first) and then by invoice number
        duplicates.sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.invoiceNumber.localeCompare(b.invoiceNumber);
        });
        
        // Calculate statistics
        const stats = {
            totalInvoices: allInvoices.length,
            totalUniqueNumbers: Object.keys(invoiceGroups).length,
            totalDuplicateNumbers: duplicateNumbers.length,
            totalDuplicateInvoices: duplicates.reduce((sum, dup) => sum + dup.count, 0),
            largestDuplicateGroup: duplicates.length > 0 ? duplicates[0].count : 0,
            invoicesWithoutNumbers: allInvoices.filter(inv => !inv.invoiceNumber).length
        };
        
        // Display results
        console.log('📊 INVOICE DATABASE ANALYSIS:');
        console.log('=' .repeat(60));
        
        console.log('\n📈 STATISTICS:');
        console.log(`   📄 Total Invoices in Database: ${stats.totalInvoices.toLocaleString()}`);
        console.log(`   🔢 Unique Invoice Numbers: ${stats.totalUniqueNumbers.toLocaleString()}`);
        console.log(`   ❓ Invoices Without Numbers: ${stats.invoicesWithoutNumbers.toLocaleString()}`);
        console.log(`   ⚠️  Duplicate Numbers Found: ${stats.totalDuplicateNumbers.toLocaleString()}`);
        console.log(`   🔄 Total Affected Invoices: ${stats.totalDuplicateInvoices.toLocaleString()}`);
        console.log(`   📊 Largest Duplicate Group: ${stats.largestDuplicateGroup}`);
        
        // Display summary
        console.log('\n🎯 RESULT:');
        const hasDuplicates = duplicates.length > 0;
        const message = hasDuplicates 
            ? `Found ${duplicates.length} invoice numbers with duplicates affecting ${stats.totalDuplicateInvoices} total invoices ⚠️`
            : 'No duplicate invoice numbers found! ✅';
        
        console.log(`   ${message}`);
        
        // Display detailed duplicates if any
        if (duplicates.length > 0) {
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
        
        // Return results for programmatic use
        return {
            success: true,
            hasDuplicates: duplicates.length > 0,
            duplicateCount: duplicates.length,
            totalAffectedInvoices: stats.totalDuplicateInvoices,
            statistics: stats,
            duplicates: duplicates
        };
        
    } catch (error) {
        console.error('\n❌ ERROR SEARCHING FOR DUPLICATES:');
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('   • Check your service account credentials');
        console.log('   • Verify Firestore access permissions');
        console.log('   • Ensure the invoices collection exists');
        
        throw error;
    }
}

// Run the analysis
if (require.main === module) {
    findDuplicateInvoices()
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

module.exports = { findDuplicateInvoices };
