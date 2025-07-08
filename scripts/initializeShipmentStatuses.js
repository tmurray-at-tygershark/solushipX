const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin SDK
const serviceAccount = require('../functions/service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://solushipx.firebaseio.com"
});

const db = admin.firestore();

// Default Master Statuses based on common shipping workflows
const MASTER_STATUSES = [
    {
        label: 'pending',
        displayLabel: 'Pending',
        description: 'Shipment is being prepared and not yet in transit',
        color: '#f59e0b',
        sortOrder: 0,
        enabled: true
    },
    {
        label: 'booked',
        displayLabel: 'Booked',
        description: 'Shipment has been booked with carrier',
        color: '#3b82f6',
        sortOrder: 1,
        enabled: true
    },
    {
        label: 'scheduled',
        displayLabel: 'Scheduled',
        description: 'Pickup or delivery has been scheduled',
        color: '#6366f1',
        sortOrder: 2,
        enabled: true
    },
    {
        label: 'in_transit',
        displayLabel: 'In Transit',
        description: 'Shipment is currently being transported',
        color: '#10b981',
        sortOrder: 3,
        enabled: true
    },
    {
        label: 'completed',
        displayLabel: 'Completed',
        description: 'Shipment has been successfully delivered',
        color: '#059669',
        sortOrder: 4,
        enabled: true
    },
    {
        label: 'exception',
        displayLabel: 'Exception',
        description: 'Shipment has encountered issues or delays',
        color: '#ef4444',
        sortOrder: 5,
        enabled: true
    },
    {
        label: 'on_hold',
        displayLabel: 'On Hold',
        description: 'Shipment is temporarily stopped',
        color: '#f97316',
        sortOrder: 6,
        enabled: true
    },
    {
        label: 'cancelled',
        displayLabel: 'Cancelled',
        description: 'Shipment has been cancelled',
        color: '#6b7280',
        sortOrder: 7,
        enabled: true
    }
];

// Generate status code based on label (similar to cloud function logic)
const generateStatusCode = (label) => {
    let code = 0;
    for (let i = 0; i < label.length; i++) {
        code += label.charCodeAt(i);
    }
    // Add timestamp to ensure uniqueness
    code = code + Date.now() % 1000;
    return code;
};

// Sample Shipment Statuses based on the HTML provided
const createShipmentStatuses = (masterStatusMap) => [
    // Pre-Shipment statuses
    {
        masterStatus: masterStatusMap['pending'],
        statusLabel: 'Ready for shipping',
        statusMeaning: 'Your shipment is prepared and ready to be picked up by the carrier',
        statusCode: 10,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['pending'],
        statusLabel: 'Ready to process',
        statusMeaning: 'Your shipment request is being processed by our team',
        statusCode: 80,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['pending'],
        statusLabel: 'Sent to warehouse',
        statusMeaning: 'Your shipment has been forwarded to the warehouse for processing',
        statusCode: 100,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['pending'],
        statusLabel: 'Received by warehouse',
        statusMeaning: 'The warehouse has received your shipment and is preparing it',
        statusCode: 110,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['pending'],
        statusLabel: 'Request Quote',
        statusMeaning: 'We are obtaining shipping quotes for your shipment',
        statusCode: 111,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['pending'],
        statusLabel: 'Quoted',
        statusMeaning: 'Shipping quote has been provided and awaiting approval',
        statusCode: 112,
        enabled: true
    },

    // Booking & Scheduling statuses
    {
        masterStatus: masterStatusMap['scheduled'],
        statusLabel: 'Scheduled for pick up',
        statusMeaning: 'A pickup time has been scheduled for your shipment',
        statusCode: 16,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['scheduled'],
        statusLabel: 'Booking appointment',
        statusMeaning: 'We are scheduling an appointment for your shipment',
        statusCode: 22,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['scheduled'],
        statusLabel: 'Appointment',
        statusMeaning: 'An appointment has been set for pickup or delivery',
        statusCode: 122,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['scheduled'],
        statusLabel: 'Awaiting appointment',
        statusMeaning: 'Waiting for appointment confirmation from carrier or recipient',
        statusCode: 250,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['scheduled'],
        statusLabel: 'Appointment confirmed',
        statusMeaning: 'The pickup or delivery appointment has been confirmed',
        statusCode: 260,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['booked'],
        statusLabel: 'Booking confirmed',
        statusMeaning: 'Your shipment booking has been confirmed with the carrier',
        statusCode: 309,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['booked'],
        statusLabel: 'Booking requested',
        statusMeaning: 'A booking request has been submitted to the carrier',
        statusCode: 319,
        enabled: true
    },

    // In Transit statuses
    {
        masterStatus: masterStatusMap['in_transit'],
        statusLabel: 'Out for pickup',
        statusMeaning: 'The carrier is en route to pick up your shipment',
        statusCode: 12,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['in_transit'],
        statusLabel: 'Picked up',
        statusMeaning: 'Your shipment has been picked up by the carrier',
        statusCode: 19,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['in_transit'],
        statusLabel: 'In transit',
        statusMeaning: 'Your shipment is currently being transported to its destination',
        statusCode: 20,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['in_transit'],
        statusLabel: 'On route',
        statusMeaning: 'Your shipment is on its way to the destination',
        statusCode: 21,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['in_transit'],
        statusLabel: 'In customs',
        statusMeaning: 'Your shipment is at border customs inspection',
        statusCode: 25,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['in_transit'],
        statusLabel: 'At terminal',
        statusMeaning: 'Your shipment has arrived at the carrier terminal',
        statusCode: 26,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['in_transit'],
        statusLabel: 'Out for delivery',
        statusMeaning: 'Your shipment is out for delivery to the final destination',
        statusCode: 23,
        enabled: true
    },

    // Completed statuses
    {
        masterStatus: masterStatusMap['completed'],
        statusLabel: 'Delivered',
        statusMeaning: 'Your shipment has been successfully delivered',
        statusCode: 30,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['completed'],
        statusLabel: 'Closed',
        statusMeaning: 'The shipment has been completed and the case is closed',
        statusCode: 70,
        enabled: true
    },

    // Exception statuses
    {
        masterStatus: masterStatusMap['exception'],
        statusLabel: 'Exception',
        statusMeaning: 'Your shipment has encountered an unexpected issue',
        statusCode: 50,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['exception'],
        statusLabel: 'Undelivered',
        statusMeaning: 'Delivery attempt was unsuccessful',
        statusCode: 113,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['exception'],
        statusLabel: 'Attempted delivery',
        statusMeaning: 'Delivery was attempted but unsuccessful',
        statusCode: 114,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['exception'],
        statusLabel: 'Refused',
        statusMeaning: 'The shipment was refused by the recipient',
        statusCode: 115,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['exception'],
        statusLabel: 'Weather delay',
        statusMeaning: 'Your shipment is delayed due to weather conditions',
        statusCode: 120,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['exception'],
        statusLabel: 'Delay',
        statusMeaning: 'Your shipment is experiencing a delay',
        statusCode: 300,
        enabled: true
    },

    // On Hold statuses
    {
        masterStatus: masterStatusMap['on_hold'],
        statusLabel: 'On hold',
        statusMeaning: 'Your shipment is temporarily on hold',
        statusCode: 290,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['on_hold'],
        statusLabel: 'Hold for appointment',
        statusMeaning: 'Shipment is being held pending appointment confirmation',
        statusCode: 270,
        enabled: true
    },
    {
        masterStatus: masterStatusMap['on_hold'],
        statusLabel: 'Held for pick up',
        statusMeaning: 'Shipment is ready and being held for pickup',
        statusCode: 280,
        enabled: true
    },

    // Cancelled statuses
    {
        masterStatus: masterStatusMap['cancelled'],
        statusLabel: 'Cancelled',
        statusMeaning: 'Your shipment has been cancelled',
        statusCode: 40,
        enabled: true
    }
];

async function initializeShipmentStatuses() {
    try {
        console.log('🚀 Starting shipment statuses initialization...');

        // First, create master statuses
        console.log('📋 Creating master statuses...');
        const masterStatusMap = {};
        
        for (const masterStatus of MASTER_STATUSES) {
            const masterStatusData = {
                ...masterStatus,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'system',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: 'system'
            };

            const docRef = await db.collection('masterStatuses').add(masterStatusData);
            masterStatusMap[masterStatus.label] = docRef.id;
            
            console.log(`✅ Created master status: ${masterStatus.displayLabel} (ID: ${docRef.id})`);
        }

        // Then, create shipment statuses
        console.log('📦 Creating shipment statuses...');
        const shipmentStatuses = createShipmentStatuses(masterStatusMap);

        for (const shipmentStatus of shipmentStatuses) {
            const shipmentStatusData = {
                ...shipmentStatus,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'system',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: 'system'
            };

            const docRef = await db.collection('shipmentStatuses').add(shipmentStatusData);
            
            console.log(`✅ Created shipment status: ${shipmentStatus.statusLabel} (Code: ${shipmentStatus.statusCode}, ID: ${docRef.id})`);
        }

        console.log('🎉 Shipment statuses initialization completed successfully!');
        console.log(`📊 Summary: ${MASTER_STATUSES.length} master statuses and ${shipmentStatuses.length} shipment statuses created.`);

    } catch (error) {
        console.error('❌ Error initializing shipment statuses:', error);
        throw error;
    }
}

// Run the initialization
if (require.main === module) {
    initializeShipmentStatuses()
        .then(() => {
            console.log('✅ Initialization complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeShipmentStatuses }; 