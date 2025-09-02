const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function debugTemspecCustomerFields() {
    console.log('🔍 DEBUGGING TEMSPEC CUSTOMER FIELD STRUCTURE');
    console.log('=============================================\n');
    
    try {
        // Get ALL shipments from database
        console.log('📦 Loading ALL shipments...');
        const shipmentsSnapshot = await db.collection('shipments').get();
        
        // Find TEMSPEC shipments using broad search
        const temspecShipments = [];
        
        shipmentsSnapshot.docs.forEach(doc => {
            const shipment = { id: doc.id, ...doc.data() };
            const searchableText = JSON.stringify(shipment).toLowerCase();
            
            if (searchableText.includes('temspec')) {
                temspecShipments.push(shipment);
            }
        });
        
        console.log(`📊 Found ${temspecShipments.length} TEMSPEC shipments\n`);
        
        // Analyze customer field structure for first 10 TEMSPEC shipments
        console.log('🔍 CUSTOMER FIELD ANALYSIS (first 10 shipments):');
        console.log('='.repeat(80));
        
        temspecShipments.slice(0, 10).forEach((shipment, index) => {
            console.log(`\n📦 Shipment ${index + 1}: ${shipment.shipmentID || shipment.id}`);
            console.log('─'.repeat(50));
            
            // Check all possible customer fields
            const customerFields = {
                'customerId': shipment.customerId,
                'customerID': shipment.customerID,
                'customer.id': shipment.customer?.id,
                'shipFrom.customerID': shipment.shipFrom?.customerID,
                'shipFrom.customerId': shipment.shipFrom?.customerId,
                'shipFrom.addressClassID': shipment.shipFrom?.addressClassID,
                'shipTo.customerID': shipment.shipTo?.customerID,
                'shipTo.customerId': shipment.shipTo?.customerId,
                'shipTo.addressClassID': shipment.shipTo?.addressClassID,
                'companyID': shipment.companyID,
                'shipTo.company': shipment.shipTo?.company,
                'shipTo.companyName': shipment.shipTo?.companyName
            };
            
            Object.entries(customerFields).forEach(([field, value]) => {
                if (value) {
                    console.log(`  ✅ ${field}: "${value}"`);
                }
            });
            
            // Show if any field contains "TEMSPEC"
            const temspecFields = [];
            Object.entries(customerFields).forEach(([field, value]) => {
                if (value && String(value).toLowerCase().includes('temspec')) {
                    temspecFields.push(`${field}: "${value}"`);
                }
            });
            
            if (temspecFields.length > 0) {
                console.log(`  🎯 TEMSPEC matches: ${temspecFields.join(', ')}`);
            }
        });
        
        // Show unique values that appear in customer selection dropdown
        console.log('\n\n🎯 UNIQUE CUSTOMER VALUES FOR DROPDOWN:');
        console.log('='.repeat(50));
        
        const uniqueCustomerValues = new Set();
        
        temspecShipments.forEach(shipment => {
            // Same logic as the fixed filter
            const shipmentCustomerId = shipment?.customerId ||
                shipment?.customerID ||
                shipment?.customer?.id ||
                shipment?.shipFrom?.customerID ||
                shipment?.shipFrom?.customerId ||
                shipment?.shipFrom?.addressClassID;
                
            if (shipmentCustomerId) {
                uniqueCustomerValues.add(shipmentCustomerId);
            }
        });
        
        console.log('Values that should appear in customer dropdown:');
        Array.from(uniqueCustomerValues).sort().forEach(value => {
            console.log(`  📋 "${value}"`);
        });
        
        console.log('\n🔍 SUMMARY:');
        console.log(`📊 Total TEMSPEC shipments: ${temspecShipments.length}`);
        console.log(`🎯 Unique customer IDs: ${uniqueCustomerValues.size}`);
        console.log(`💡 Main customer ID appears to be: "${Array.from(uniqueCustomerValues)[0] || 'NOT FOUND'}"`);
        
        // Check what customer filter value should be used
        const mainCustomerValue = Array.from(uniqueCustomerValues)[0];
        if (mainCustomerValue && mainCustomerValue.toLowerCase().includes('temspec')) {
            console.log(`✅ Filter should use: "${mainCustomerValue}"`);
        } else {
            console.log(`❌ No obvious TEMSPEC customer ID found in standard fields`);
            console.log(`💡 May need to check company-level filtering instead`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugTemspecCustomerFields();
