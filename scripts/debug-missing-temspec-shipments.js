const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function debugMissingTemspecShipments() {
    console.log('🔍 DEBUGGING MISSING TEMSPEC SHIPMENTS');
    console.log('=====================================\n');
    
    try {
        // Get ALL shipments from database
        console.log('📦 Loading ALL shipments from database...');
        const shipmentsSnapshot = await db.collection('shipments').get();
        
        console.log(`📊 Total shipments in database: ${shipmentsSnapshot.size}\n`);
        
        // Analyze all shipments for TEMSPEC matches
        const allShipments = [];
        const temspecShipments = [];
        const temspecVariations = new Set();
        
        shipmentsSnapshot.forEach(doc => {
            const data = doc.data();
            const shipmentData = {
                id: doc.id,
                shipmentID: data.shipmentID || doc.id,
                status: data.status || 'unknown',
                createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
                
                // All possible customer/company fields
                customerName: data.customerName || '',
                companyName: data.companyName || '',
                companyID: data.companyID || '',
                
                // Ship To fields
                shipToCompany: data.shipTo?.companyName || data.shipTo?.company || '',
                shipToCustomer: data.shipTo?.customerName || '',
                shipToContactName: data.shipTo?.firstName && data.shipTo?.lastName ? 
                    `${data.shipTo.firstName} ${data.shipTo.lastName}` : '',
                
                // Ship From fields  
                shipFromCompany: data.shipFrom?.companyName || data.shipFrom?.company || '',
                shipFromCustomer: data.shipFrom?.customerName || '',
                shipFromContactName: data.shipFrom?.firstName && data.shipFrom?.lastName ? 
                    `${data.shipFrom.firstName} ${data.shipFrom.lastName}` : '',
                
                // Billing fields
                billingCustomer: data.billingDetails?.customerName || '',
                billingCompany: data.billingDetails?.companyName || '',
                
                // Additional fields that might contain customer info
                selectedCustomer: data.selectedCustomer || '',
                notes: data.notes || '',
                specialInstructions: data.specialInstructions || ''
            };
            
            allShipments.push(shipmentData);
            
            // Check ALL fields for TEMSPEC (case-insensitive)
            const fieldsToCheck = [
                shipmentData.customerName,
                shipmentData.companyName,
                shipmentData.shipToCompany,
                shipmentData.shipToCustomer,
                shipmentData.shipToContactName,
                shipmentData.shipFromCompany,
                shipmentData.shipFromCustomer,
                shipmentData.shipFromContactName,
                shipmentData.billingCustomer,
                shipmentData.billingCompany,
                shipmentData.selectedCustomer,
                shipmentData.notes,
                shipmentData.specialInstructions
            ];
            
            let matchedField = null;
            let matchedValue = null;
            
            for (const field of fieldsToCheck) {
                if (field && field.toString().toUpperCase().includes('TEMSPEC')) {
                    matchedField = Object.keys(shipmentData).find(key => shipmentData[key] === field);
                    matchedValue = field;
                    temspecVariations.add(field); // Track variations
                    break;
                }
            }
            
            if (matchedField) {
                temspecShipments.push({
                    ...shipmentData,
                    matchedField,
                    matchedValue,
                    isArchived: shipmentData.status === 'archived',
                    isDraft: shipmentData.status === 'draft',
                    isDeleted: shipmentData.status === 'deleted'
                });
            }
        });
        
        console.log(`🎯 TEMSPEC shipments found: ${temspecShipments.length}`);
        console.log(`📝 TEMSPEC variations found: ${temspecVariations.size}`);
        
        // Show all TEMSPEC variations
        console.log('\n🔤 ALL TEMSPEC VARIATIONS FOUND:');
        console.log('─'.repeat(50));
        [...temspecVariations].sort().forEach((variation, index) => {
            const count = temspecShipments.filter(s => s.matchedValue === variation).length;
            console.log(`${index + 1}. "${variation}" (${count} shipments)`);
        });
        
        // Group by status
        const statusGroups = {};
        temspecShipments.forEach(shipment => {
            const status = shipment.status || 'unknown';
            if (!statusGroups[status]) {
                statusGroups[status] = [];
            }
            statusGroups[status].push(shipment);
        });
        
        console.log('\n📊 TEMSPEC SHIPMENTS BY STATUS:');
        console.log('─'.repeat(50));
        Object.entries(statusGroups).forEach(([status, shipments]) => {
            console.log(`${status.toUpperCase()}: ${shipments.length} shipments`);
        });
        
        // Show potential filtering issues
        console.log('\n⚠️  POTENTIAL FILTERING ISSUES:');
        console.log('─'.repeat(50));
        
        const archivedCount = temspecShipments.filter(s => s.isArchived).length;
        const draftCount = temspecShipments.filter(s => s.isDraft).length;
        const deletedCount = temspecShipments.filter(s => s.isDeleted).length;
        
        if (archivedCount > 0) {
            console.log(`🗃️  ${archivedCount} archived shipments (might be filtered out)`);
        }
        if (draftCount > 0) {
            console.log(`📝 ${draftCount} draft shipments (might be filtered out)`);
        }
        if (deletedCount > 0) {
            console.log(`🗑️  ${deletedCount} deleted shipments (should be filtered out)`);
        }
        
        // Calculate what should be visible
        const visibleShipments = temspecShipments.filter(s => 
            !s.isDeleted && s.status !== 'deleted'
        );
        
        console.log(`\n🎯 EXPECTED VISIBLE SHIPMENTS: ${visibleShipments.length}`);
        console.log(`📺 ACTUALLY SHOWING: 67`);
        console.log(`❓ MISSING: ${visibleShipments.length - 67}`);
        
        // Show missing shipments (those that should be visible but aren't)
        if (visibleShipments.length > 67) {
            // This is a simplified way to identify potentially missing ones
            // In reality, we'd need to know exactly which 67 are showing
            console.log('\n🔍 ANALYSIS OF ALL VISIBLE TEMSPEC SHIPMENTS:');
            console.log('─'.repeat(60));
            
            // Group by creation date to see if there's a pattern
            const recentShipments = visibleShipments.filter(s => {
                const date = s.createdAt ? new Date(s.createdAt) : null;
                return date && date >= new Date('2025-08-01');
            });
            
            const olderShipments = visibleShipments.filter(s => {
                const date = s.createdAt ? new Date(s.createdAt) : null;
                return !date || date < new Date('2025-08-01');
            });
            
            console.log(`📅 August 2025+ shipments: ${recentShipments.length}`);
            console.log(`📅 July 2025 and older: ${olderShipments.length}`);
            
            // Show company ID analysis
            const companyGroups = {};
            visibleShipments.forEach(shipment => {
                const companyId = shipment.companyID || 'No Company ID';
                if (!companyGroups[companyId]) {
                    companyGroups[companyId] = [];
                }
                companyGroups[companyId].push(shipment);
            });
            
            console.log('\n🏢 TEMSPEC SHIPMENTS BY COMPANY ID:');
            console.log('─'.repeat(50));
            Object.entries(companyGroups).forEach(([companyId, shipments]) => {
                console.log(`${companyId}: ${shipments.length} shipments`);
            });
            
            // Show detailed list of ALL TEMSPEC shipments with key info
            console.log('\n📋 ALL TEMSPEC SHIPMENTS (sorted by date):');
            console.log('─'.repeat(80));
            
            const sortedShipments = visibleShipments.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA; // Newest first
            });
            
            sortedShipments.forEach((shipment, index) => {
                const date = shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString() : 'No Date';
                console.log(`${index + 1}. ${shipment.shipmentID} | ${shipment.status} | ${date} | Company: ${shipment.companyID || 'None'}`);
                console.log(`   Matched: ${shipment.matchedField} = "${shipment.matchedValue}"`);
                if (index < sortedShipments.length - 1) console.log('');
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Analysis completed!');
        
        return {
            totalShipments: allShipments.length,
            temspecShipments: temspecShipments.length,
            visibleShipments: visibleShipments.length,
            variations: [...temspecVariations],
            statusGroups
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
    debugMissingTemspecShipments()
        .then((results) => {
            console.log('\n🏁 Debug analysis complete!');
            console.log(`📊 Found ${results.temspecShipments} total TEMSPEC shipments`);
            console.log(`👁️  Expected visible: ${results.visibleShipments}`);
            console.log(`❓ Missing from view: ${results.visibleShipments - 67}`);
        })
        .catch((error) => {
            console.error('\n💥 Analysis failed:', error.message);
            process.exit(1);
        });
}

module.exports = { debugMissingTemspecShipments };
