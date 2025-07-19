const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.resolve(__dirname, '../functions/service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://solushipx.firebaseio.com'
    });
}

const db = admin.firestore();

// Default invoice statuses to create
const defaultInvoiceStatuses = [
    {
        statusLabel: 'Uninvoiced',
        statusCode: 'uninvoiced',
        statusDescription: 'Shipment has not been invoiced yet',
        color: '#f59e0b',
        fontColor: '#ffffff',
        sortOrder: 0,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Draft',
        statusCode: 'draft',
        statusDescription: 'Invoice is in draft status',
        color: '#6b7280',
        fontColor: '#ffffff',
        sortOrder: 1,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Invoiced',
        statusCode: 'invoiced',
        statusDescription: 'Invoice has been generated and sent to customer',
        color: '#3b82f6',
        fontColor: '#ffffff',
        sortOrder: 2,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Sent',
        statusCode: 'sent',
        statusDescription: 'Invoice has been sent to customer',
        color: '#8b5cf6',
        fontColor: '#ffffff',
        sortOrder: 3,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Viewed',
        statusCode: 'viewed',
        statusDescription: 'Customer has viewed the invoice',
        color: '#06b6d4',
        fontColor: '#ffffff',
        sortOrder: 4,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Partial Payment',
        statusCode: 'partial_payment',
        statusDescription: 'Invoice has been partially paid',
        color: '#f97316',
        fontColor: '#ffffff',
        sortOrder: 5,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Paid',
        statusCode: 'paid',
        statusDescription: 'Invoice has been paid in full',
        color: '#10b981',
        fontColor: '#ffffff',
        sortOrder: 6,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Overdue',
        statusCode: 'overdue',
        statusDescription: 'Invoice payment is overdue',
        color: '#ef4444',
        fontColor: '#ffffff',
        sortOrder: 7,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Cancelled',
        statusCode: 'cancelled',
        statusDescription: 'Invoice has been cancelled',
        color: '#6b7280',
        fontColor: '#ffffff',
        sortOrder: 8,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    },
    {
        statusLabel: 'Refunded',
        statusCode: 'refunded',
        statusDescription: 'Invoice has been refunded',
        color: '#ec4899',
        fontColor: '#ffffff',
        sortOrder: 9,
        enabled: true,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
    }
];

async function createDefaultInvoiceStatuses() {
    try {
        console.log('🚀 Creating default invoice statuses...');

        // Check if any invoice statuses already exist
        const existingStatuses = await db.collection('invoiceStatuses').limit(1).get();
        
        if (!existingStatuses.empty) {
            console.log('⚠️  Invoice statuses already exist. Skipping creation.');
            console.log('To recreate, delete the existing invoiceStatuses collection first.');
            return;
        }

        // Create each status
        for (const status of defaultInvoiceStatuses) {
            const docRef = await db.collection('invoiceStatuses').add(status);
            console.log(`✅ Created invoice status: ${status.statusLabel} (${docRef.id})`);
        }

        console.log(`🎉 Successfully created ${defaultInvoiceStatuses.length} default invoice statuses!`);
        console.log('');
        console.log('Created statuses:');
        defaultInvoiceStatuses.forEach((status, index) => {
            console.log(`  ${index + 1}. ${status.statusLabel} (${status.statusCode}) - ${status.color}`);
        });

    } catch (error) {
        console.error('❌ Error creating default invoice statuses:', error);
        throw error;
    }
}

async function main() {
    try {
        await createDefaultInvoiceStatuses();
        console.log('\n✨ All done! Invoice statuses are ready to use.');
    } catch (error) {
        console.error('Failed to create invoice statuses:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { createDefaultInvoiceStatuses }; 