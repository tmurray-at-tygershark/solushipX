const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function countTemspecDeliveredShipments() {
    console.log('🔍 COUNTING TEMSPEC DELIVERED SHIPMENTS');
    console.log('=====================================\n');
    
    try {
        // Get all shipments
        console.log('📦 Loading all shipments...');
        const shipmentsSnapshot = await db.collection('shipments').get();
        
        // Find TEMSPEC shipments using the same logic as the fixed filter
        const temspecShipments = [];
        const temspecCustomerIds = ['TEMSPE', '65MQ6skvMVZ6Z9Zj2Sk5']; // Both TEMSPEC customer IDs
        
        shipmentsSnapshot.docs.forEach(doc => {
            const shipment = { id: doc.id, ...doc.data() };
            
            // Use same customer lookup logic as the filter
            const shipmentCustomerId = shipment?.customerId ||
                shipment?.customerID ||
                shipment?.customer?.id ||
                shipment?.shipFrom?.customerID ||
                shipment?.shipFrom?.customerId ||
                shipment?.shipFrom?.addressClassID;
            
            // Check if it's a TEMSPEC shipment
            if (temspecCustomerIds.includes(shipmentCustomerId)) {
                temspecShipments.push(shipment);
            }
        });
        
        console.log(`📊 Found ${temspecShipments.length} total TEMSPEC shipments\n`);
        
        // Count by status
        const statusCounts = {};
        const deliveredShipments = [];
        
        temspecShipments.forEach(shipment => {
            const status = shipment.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            
            if (status === 'delivered') {
                deliveredShipments.push({
                    shipmentID: shipment.shipmentID,
                    status: shipment.status,
                    customerID: shipment?.customerId || shipment?.customerID || 'unknown',
                    createdAt: shipment.createdAt?.toDate?.() || shipment.createdAt || 'unknown',
                    shipTo: shipment.shipTo?.company || 'unknown'
                });
            }
        });
        
        console.log('📈 TEMSPEC SHIPMENTS BY STATUS:');
        console.log('─'.repeat(40));
        Object.entries(statusCounts)
            .sort(([,a], [,b]) => b - a) // Sort by count descending
            .forEach(([status, count]) => {
                const percentage = ((count / temspecShipments.length) * 100).toFixed(1);
                console.log(`${status.toUpperCase().padEnd(15)} ${count.toString().padStart(3)} (${percentage}%)`);
            });
        
        console.log(`\n🚚 DELIVERED TEMSPEC SHIPMENTS (${deliveredShipments.length} total):`);
        console.log('─'.repeat(60));
        
        if (deliveredShipments.length > 0) {
            deliveredShipments
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort by date desc
                .forEach((shipment, index) => {
                    const date = shipment.createdAt instanceof Date ? 
                        shipment.createdAt.toLocaleDateString() : 
                        String(shipment.createdAt).substring(0, 10);
                    console.log(`${(index + 1).toString().padStart(2)}. ${shipment.shipmentID} (${date}) → ${shipment.shipTo}`);
                });
        } else {
            console.log('   No delivered shipments found');
        }
        
        console.log(`\n✅ SUMMARY: ${deliveredShipments.length} of ${temspecShipments.length} TEMSPEC shipments are delivered (${((deliveredShipments.length / temspecShipments.length) * 100).toFixed(1)}%)`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

countTemspecDeliveredShipments();
