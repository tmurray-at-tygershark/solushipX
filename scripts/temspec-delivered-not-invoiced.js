const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function findTemspecDeliveredNotInvoiced() {
    console.log('🔍 FINDING TEMSPEC DELIVERED BUT NOT INVOICED');
    console.log('===============================================\n');
    
    try {
        // Get all shipments and invoices
        console.log('📦 Loading shipments and invoices...');
        const [shipmentsSnapshot, invoicesSnapshot] = await Promise.all([
            db.collection('shipments').get(),
            db.collection('invoices').get()
        ]);
        
        // Find TEMSPEC shipments using the same logic as before
        const temspecCustomerIds = ['TEMSPE', '65MQ6skvMVZ6Z9Zj2Sk5']; // Both TEMSPEC customer IDs
        const temspecShipments = [];
        
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
        
        console.log(`📊 Found ${temspecShipments.length} total TEMSPEC shipments`);
        
        // Filter for delivered shipments only
        const deliveredTemspecShipments = temspecShipments.filter(s => s.status === 'delivered');
        console.log(`🚚 Found ${deliveredTemspecShipments.length} delivered TEMSPEC shipments`);
        
        // Build set of invoiced shipment IDs
        const invoicedShipmentIds = new Set();
        
        invoicesSnapshot.docs.forEach(doc => {
            const invoice = doc.data();
            
            // Check line items for shipment IDs
            if (invoice.lineItems) {
                invoice.lineItems.forEach(item => {
                    if (item.shipmentID) {
                        invoicedShipmentIds.add(item.shipmentID);
                    }
                });
            }
            
            // Also check if shipmentIds array exists
            if (invoice.shipmentIds && Array.isArray(invoice.shipmentIds)) {
                invoice.shipmentIds.forEach(id => invoicedShipmentIds.add(id));
            }
        });
        
        console.log(`📋 Found ${invoicedShipmentIds.size} unique shipment IDs in invoices\n`);
        
        // Find delivered TEMSPEC shipments that are NOT invoiced
        const deliveredNotInvoiced = deliveredTemspecShipments.filter(shipment => {
            return !invoicedShipmentIds.has(shipment.shipmentID);
        });
        
        // Find delivered TEMSPEC shipments that ARE invoiced
        const deliveredAndInvoiced = deliveredTemspecShipments.filter(shipment => {
            return invoicedShipmentIds.has(shipment.shipmentID);
        });
        
        console.log('📈 DELIVERED TEMSPEC SHIPMENTS BREAKDOWN:');
        console.log('─'.repeat(50));
        console.log(`📦 Total Delivered TEMSPEC:     ${deliveredTemspecShipments.length}`);
        console.log(`✅ Delivered + Invoiced:        ${deliveredAndInvoiced.length}`);
        console.log(`❌ Delivered + NOT Invoiced:    ${deliveredNotInvoiced.length}`);
        console.log(`📊 Invoice Coverage:            ${((deliveredAndInvoiced.length / deliveredTemspecShipments.length) * 100).toFixed(1)}%`);
        
        if (deliveredNotInvoiced.length > 0) {
            console.log(`\n🚨 DELIVERED BUT NOT INVOICED (${deliveredNotInvoiced.length} shipments):`);
            console.log('─'.repeat(60));
            
            deliveredNotInvoiced
                .sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return dateB - dateA; // Sort by date descending
                })
                .forEach((shipment, index) => {
                    const date = shipment.createdAt?.toDate?.() ? 
                        shipment.createdAt.toDate().toLocaleDateString() : 
                        String(shipment.createdAt || 'unknown').substring(0, 10);
                    const destination = shipment.shipTo?.company || 'unknown';
                    console.log(`${(index + 1).toString().padStart(2)}. ${shipment.shipmentID} (${date}) → ${destination}`);
                });
        } else {
            console.log('\n✅ ALL delivered TEMSPEC shipments have been invoiced!');
        }
        
        // Show some recent invoiced ones for comparison
        if (deliveredAndInvoiced.length > 0) {
            console.log(`\n✅ RECENTLY INVOICED (showing last 10 of ${deliveredAndInvoiced.length}):`);
            console.log('─'.repeat(60));
            
            deliveredAndInvoiced
                .sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                    const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                    return dateB - dateA; // Sort by date descending
                })
                .slice(0, 10)
                .forEach((shipment, index) => {
                    const date = shipment.createdAt?.toDate?.() ? 
                        shipment.createdAt.toDate().toLocaleDateString() : 
                        String(shipment.createdAt || 'unknown').substring(0, 10);
                    const destination = shipment.shipTo?.company || 'unknown';
                    console.log(`${(index + 1).toString().padStart(2)}. ${shipment.shipmentID} (${date}) → ${destination}`);
                });
        }
        
        console.log(`\n💰 POTENTIAL REVENUE: ${deliveredNotInvoiced.length} uninvoiced delivered shipments represent potential revenue to be captured!`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

findTemspecDeliveredNotInvoiced();
