const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function analyzeShipmentInvoiceDiscrepancy(customerName = 'TEMSPEC') {
    console.log('🔍 SHIPMENT vs INVOICE DISCREPANCY ANALYZER');
    console.log('============================================\n');
    console.log(`📊 Analyzing discrepancy for customer: ${customerName}\n`);
    
    try {
        // Step 1: Get all shipments for the customer
        console.log('📦 Step 1: Loading all shipments...');
        const shipmentsSnapshot = await db.collection('shipments').get();
        
        // Filter shipments for the customer (case-insensitive)
        const customerShipments = [];
        const allShipmentIds = new Set();
        
        shipmentsSnapshot.forEach(doc => {
            const data = doc.data();
            allShipmentIds.add(data.shipmentID || doc.id);
            
            // Check multiple fields for customer name
            const customerFields = [
                data.customerName,
                data.shipTo?.companyName,
                data.shipTo?.company,
                data.shipFrom?.companyName,
                data.shipFrom?.company,
                data.billingDetails?.customerName,
                data.companyName
            ].filter(Boolean);
            
            const matchesCustomer = customerFields.some(field => 
                field && field.toString().toUpperCase().includes(customerName.toUpperCase())
            );
            
            if (matchesCustomer) {
                customerShipments.push({
                    id: doc.id,
                    shipmentID: data.shipmentID || doc.id,
                    customerName: data.customerName || '',
                    companyName: data.companyName || '',
                    shipToCompany: data.shipTo?.companyName || data.shipTo?.company || '',
                    shipFromCompany: data.shipFrom?.companyName || data.shipFrom?.company || '',
                    status: data.status || 'unknown',
                    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
                    matchedField: customerFields.find(field => 
                        field && field.toString().toUpperCase().includes(customerName.toUpperCase())
                    )
                });
            }
        });
        
        console.log(`   📦 Total shipments in database: ${shipmentsSnapshot.size}`);
        console.log(`   🎯 ${customerName} shipments found: ${customerShipments.length}`);
        
        // Step 2: Get all invoices and analyze shipment IDs
        console.log('\n📋 Step 2: Loading all invoices...');
        const invoicesSnapshot = await db.collection('invoices').get();
        
        const customerInvoices = [];
        const allInvoiceShipmentIds = [];
        const duplicateShipmentIds = {};
        
        invoicesSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Check if invoice is for the customer
            const customerFields = [
                data.customerName,
                data.companyName
            ].filter(Boolean);
            
            const matchesCustomer = customerFields.some(field => 
                field && field.toString().toUpperCase().includes(customerName.toUpperCase())
            );
            
            if (matchesCustomer && data.shipmentIds && Array.isArray(data.shipmentIds)) {
                customerInvoices.push({
                    id: doc.id,
                    invoiceNumber: data.invoiceNumber || 'N/A',
                    customerName: data.customerName || '',
                    companyName: data.companyName || '',
                    shipmentIds: data.shipmentIds,
                    total: data.total || 0,
                    status: data.status || 'unknown',
                    createdAt: data.createdAt?.toDate?.() || data.createdAt || null
                });
                
                // Track all shipment IDs in invoices
                data.shipmentIds.forEach(shipmentId => {
                    allInvoiceShipmentIds.push({
                        invoiceId: doc.id,
                        invoiceNumber: data.invoiceNumber || 'N/A',
                        shipmentId: shipmentId
                    });
                    
                    // Track duplicates
                    if (!duplicateShipmentIds[shipmentId]) {
                        duplicateShipmentIds[shipmentId] = [];
                    }
                    duplicateShipmentIds[shipmentId].push({
                        invoiceId: doc.id,
                        invoiceNumber: data.invoiceNumber || 'N/A'
                    });
                });
            }
        });
        
        console.log(`   📋 Total invoices in database: ${invoicesSnapshot.size}`);
        console.log(`   🎯 ${customerName} invoices found: ${customerInvoices.length}`);
        console.log(`   📊 Total shipment IDs in ${customerName} invoices: ${allInvoiceShipmentIds.length}`);
        
        // Step 3: Find duplicates
        const duplicates = Object.entries(duplicateShipmentIds).filter(([shipmentId, invoices]) => invoices.length > 1);
        console.log(`   🔄 Duplicate shipment IDs found: ${duplicates.length}`);
        
        // Step 4: Analyze discrepancies
        console.log('\n🔍 Step 3: Analyzing discrepancies...\n');
        
        // Get unique shipment IDs from invoices
        const uniqueInvoiceShipmentIds = new Set(allInvoiceShipmentIds.map(item => item.shipmentId));
        const shipmentShipmentIds = new Set(customerShipments.map(s => s.shipmentID));
        
        // Find shipments in invoices but not in shipments collection
        const orphanedInvoiceShipments = [...uniqueInvoiceShipmentIds].filter(id => !shipmentShipmentIds.has(id));
        
        // Find shipments in collection but not in invoices
        const uninvoicedShipments = [...shipmentShipmentIds].filter(id => !uniqueInvoiceShipmentIds.has(id));
        
        // Results Summary
        console.log('📊 ANALYSIS RESULTS:');
        console.log('=' .repeat(50));
        console.log(`📦 Shipments in collection: ${customerShipments.length}`);
        console.log(`📋 Unique shipment IDs in invoices: ${uniqueInvoiceShipmentIds.size}`);
        console.log(`🔄 Total shipment references in invoices: ${allInvoiceShipmentIds.length}`);
        console.log(`⚠️  Duplicated shipment IDs: ${duplicates.length}`);
        console.log(`🚫 Orphaned (in invoices, not in shipments): ${orphanedInvoiceShipments.length}`);
        console.log(`📝 Uninvoiced (in shipments, not in invoices): ${uninvoicedShipments.length}`);
        
        // Show duplicate details
        if (duplicates.length > 0) {
            console.log('\n🔄 DUPLICATE SHIPMENT IDs IN INVOICES:');
            console.log('─'.repeat(60));
            duplicates.forEach(([shipmentId, invoices]) => {
                console.log(`\n📦 Shipment ID: "${shipmentId}"`);
                console.log(`   🔢 Appears in ${invoices.length} invoices:`);
                invoices.forEach((inv, index) => {
                    console.log(`      ${index + 1}. Invoice: ${inv.invoiceNumber} (ID: ${inv.invoiceId})`);
                });
            });
        }
        
        // Show orphaned shipments
        if (orphanedInvoiceShipments.length > 0) {
            console.log('\n🚫 ORPHANED SHIPMENT IDs (in invoices but not in shipments):');
            console.log('─'.repeat(60));
            orphanedInvoiceShipments.forEach(shipmentId => {
                const invoicesWithThisShipment = allInvoiceShipmentIds.filter(item => item.shipmentId === shipmentId);
                console.log(`\n📦 Shipment ID: "${shipmentId}"`);
                console.log(`   📋 Found in invoices:`);
                invoicesWithThisShipment.forEach((item, index) => {
                    console.log(`      ${index + 1}. Invoice: ${item.invoiceNumber} (ID: ${item.invoiceId})`);
                });
            });
        }
        
        // Show uninvoiced shipments (ALL)
        if (uninvoicedShipments.length > 0) {
            console.log(`\n📝 ALL UNINVOICED SHIPMENTS (${uninvoicedShipments.length} total):`);
            console.log('─'.repeat(60));
            uninvoicedShipments.forEach((shipmentId, index) => {
                const shipment = customerShipments.find(s => s.shipmentID === shipmentId);
                const createdDate = shipment?.createdAt ? new Date(shipment.createdAt).toLocaleDateString() : 'Unknown';
                console.log(`${index + 1}. 📦 ${shipmentId}`);
                console.log(`   Status: ${shipment?.status || 'unknown'}`);
                console.log(`   Customer: ${shipment?.matchedField || 'unknown'}`);
                console.log(`   Created: ${createdDate}`);
                console.log(`   Ship To: ${shipment?.shipToCompany || 'N/A'}`);
                console.log(`   Company: ${shipment?.companyName || 'N/A'}`);
                console.log('');
            });
        }
        
        // Show customer shipments sample for debugging
        console.log(`\n🔍 SAMPLE ${customerName} SHIPMENTS (first 5):`);
        console.log('─'.repeat(60));
        customerShipments.slice(0, 5).forEach(shipment => {
            console.log(`📦 ${shipment.shipmentID}`);
            console.log(`   Customer: ${shipment.customerName || 'N/A'}`);
            console.log(`   Company: ${shipment.companyName || 'N/A'}`);
            console.log(`   Ship To: ${shipment.shipToCompany || 'N/A'}`);
            console.log(`   Matched Field: ${shipment.matchedField || 'N/A'}`);
            console.log(`   Status: ${shipment.status}`);
            console.log('');
        });
        
        // Show customer invoices sample
        console.log(`\n📋 SAMPLE ${customerName} INVOICES (first 3):`);
        console.log('─'.repeat(60));
        customerInvoices.slice(0, 3).forEach(invoice => {
            console.log(`📋 Invoice: ${invoice.invoiceNumber}`);
            console.log(`   Customer: ${invoice.customerName || 'N/A'}`);
            console.log(`   Company: ${invoice.companyName || 'N/A'}`);
            console.log(`   Shipments: ${invoice.shipmentIds.length} [${invoice.shipmentIds.slice(0, 3).join(', ')}${invoice.shipmentIds.length > 3 ? '...' : ''}]`);
            console.log(`   Total: $${invoice.total}`);
            console.log('');
        });
        
        console.log('\n' + '='.repeat(50));
        
        // Conclusions
        console.log('\n💡 POSSIBLE EXPLANATIONS:');
        
        if (duplicates.length > 0) {
            console.log('   🔄 Duplicate shipment IDs in invoices could inflate the count');
        }
        
        if (orphanedInvoiceShipments.length > 0) {
            console.log('   🚫 Some shipments referenced in invoices may have been deleted');
            console.log('      or the shipment IDs may be incorrect');
        }
        
        if (uninvoicedShipments.length > 0) {
            console.log('   📝 Some shipments exist but haven\'t been invoiced yet');
        }
        
        console.log('\n✅ Analysis completed!');
        
        return {
            shipmentsCount: customerShipments.length,
            invoicesCount: customerInvoices.length,
            uniqueInvoiceShipmentIds: uniqueInvoiceShipmentIds.size,
            totalInvoiceShipmentReferences: allInvoiceShipmentIds.length,
            duplicatesCount: duplicates.length,
            orphanedCount: orphanedInvoiceShipments.length,
            uninvoicedCount: uninvoicedShipments.length,
            duplicates,
            orphanedShipments: orphanedInvoiceShipments,
            uninvoicedShipments
        };
        
    } catch (error) {
        console.error('\n❌ ERROR DURING ANALYSIS:');
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
        throw error;
    }
}

// Run the analysis
if (require.main === module) {
    const customerName = process.argv[2] || 'TEMSPEC';
    
    analyzeShipmentInvoiceDiscrepancy(customerName)
        .then((results) => {
            console.log('\n🏁 Analysis complete!');
            
            if (results.duplicatesCount > 0 || results.orphanedCount > 0) {
                console.log(`⚠️  Found ${results.duplicatesCount} duplicates and ${results.orphanedCount} orphaned shipments.`);
                process.exit(1);
            } else {
                console.log('✅ No duplicates or orphaned shipments found.');
                process.exit(0);
            }
        })
        .catch((error) => {
            console.error('\n💥 Analysis failed:', error.message);
            process.exit(1);
        });
}

module.exports = { analyzeShipmentInvoiceDiscrepancy };
