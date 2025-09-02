const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function testCustomerFilterLogic() {
    console.log('🔍 TESTING CUSTOMER FILTER LOGIC');
    console.log('=================================\n');
    
    try {
        // Get all shipments and customers
        console.log('📦 Loading shipments and customers...');
        const [shipmentsSnapshot, customersSnapshot] = await Promise.all([
            db.collection('shipments').get(),
            db.collection('customers').get()
        ]);
        
        // Build customers map
        const customers = {};
        customersSnapshot.docs.forEach(doc => {
            customers[doc.id] = doc.data();
        });
        
        // Find TEMSPEC shipments
        const temspecShipments = [];
        shipmentsSnapshot.docs.forEach(doc => {
            const shipment = { id: doc.id, ...doc.data() };
            const searchableText = JSON.stringify(shipment).toLowerCase();
            
            if (searchableText.includes('temspec')) {
                temspecShipments.push(shipment);
            }
        });
        
        console.log(`📊 Found ${temspecShipments.length} TEMSPEC shipments total\n`);
        
        // Test the filter logic with "Temspec Inc."
        const selectedCustomer = "Temspec Inc.";
        console.log(`🧪 Testing filter logic with selectedCustomer: "${selectedCustomer}"\n`);
        
        let matchedShipments = 0;
        const matchReasons = {
            shipmentCustomerId: 0,
            customerNameFromMap: 0,
            shipToCompany: 0,
            enhancedNameMatch: 0
        };
        
        temspecShipments.forEach((shipment, index) => {
            // Same logic as the fixed filter
            const shipmentCustomerId = shipment?.customerId ||
                shipment?.customerID ||
                shipment?.customer?.id ||
                shipment?.shipFrom?.customerID ||
                shipment?.shipFrom?.customerId ||
                shipment?.shipFrom?.addressClassID;
                
            const customerNameFromMap = customers[shipmentCustomerId];
            
            // Test each match condition
            const match1 = shipmentCustomerId === selectedCustomer;
            const match2 = customerNameFromMap === selectedCustomer;
            const match3 = shipment.shipTo?.company === selectedCustomer;
            const match4 = Object.entries(customers).some(([id, customerData]) => 
                id === shipmentCustomerId && 
                (customerData.name === selectedCustomer || customerData.companyName === selectedCustomer)
            );
            
            if (match1) matchReasons.shipmentCustomerId++;
            if (match2) matchReasons.customerNameFromMap++;
            if (match3) matchReasons.shipToCompany++;
            if (match4) matchReasons.enhancedNameMatch++;
            
            const matches = [match1, match2, match3, match4].some(Boolean);
            
            if (matches) {
                matchedShipments++;
                if (index < 5) { // Show details for first 5 matches
                    console.log(`✅ MATCH ${matchedShipments}: ${shipment.shipmentID || shipment.id}`);
                    console.log(`   shipmentCustomerId: "${shipmentCustomerId}"`);
                    console.log(`   customerNameFromMap: "${customerNameFromMap?.name || customerNameFromMap?.companyName || 'NOT FOUND'}"`);
                    console.log(`   shipTo.company: "${shipment.shipTo?.company || 'NOT SET'}"`);
                    console.log(`   Matches: [${match1}, ${match2}, ${match3}, ${match4}]`);
                }
            } else if (index < 5) { // Show details for first 5 non-matches
                console.log(`❌ NO MATCH: ${shipment.shipmentID || shipment.id}`);
                console.log(`   shipmentCustomerId: "${shipmentCustomerId}"`);
                console.log(`   customerNameFromMap: "${customerNameFromMap?.name || customerNameFromMap?.companyName || 'NOT FOUND'}"`);
                console.log(`   shipTo.company: "${shipment.shipTo?.company || 'NOT SET'}"`);
            }
        });
        
        console.log(`\n📊 FILTER RESULTS:`);
        console.log(`   Total TEMSPEC shipments: ${temspecShipments.length}`);
        console.log(`   Matched by filter: ${matchedShipments}`);
        console.log(`   Match reasons:`);
        console.log(`     - Direct customer ID: ${matchReasons.shipmentCustomerId}`);
        console.log(`     - Customer name map: ${matchReasons.customerNameFromMap}`);
        console.log(`     - ShipTo company: ${matchReasons.shipToCompany}`);
        console.log(`     - Enhanced name match: ${matchReasons.enhancedNameMatch}`);
        
        // Test what happens if we use "TEMSPE" instead
        console.log(`\n🧪 Testing with customer ID "TEMSPE" instead:`);
        const testCustomerId = "TEMSPE";
        let idMatches = 0;
        
        temspecShipments.forEach(shipment => {
            const shipmentCustomerId = shipment?.customerId ||
                shipment?.customerID ||
                shipment?.customer?.id ||
                shipment?.shipFrom?.customerID ||
                shipment?.shipFrom?.customerId ||
                shipment?.shipFrom?.addressClassID;
                
            if (shipmentCustomerId === testCustomerId) {
                idMatches++;
            }
        });
        
        console.log(`   Direct ID matches with "TEMSPE": ${idMatches}`);
        
        console.log(`\n💡 ANALYSIS:`);
        if (matchedShipments === 41) {
            console.log(`✅ Filter logic is working but only matching 41/92 shipments`);
            console.log(`💭 This suggests some TEMSPEC shipments don't have the expected customer fields`);
        } else {
            console.log(`⚠️  Filter logic would match ${matchedShipments} shipments`);
            console.log(`💭 But UI shows 41 - there may be other filtering happening`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testCustomerFilterLogic();
