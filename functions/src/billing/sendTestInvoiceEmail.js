const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');

// Initialize Firebase Admin (if not already initialized)
if (!process.env.FUNCTIONS_EMULATOR) {
    try {
        initializeApp();
    } catch (error) {
        // App already initialized
    }
}

const db = getFirestore();

// Import the existing invoice generation and email helper
const { generateInvoicePDFAndEmailHelper, getNextInvoiceNumber } = require('../generateInvoicePDFAndEmail');

/**
 * Send Test Invoice Email - Generates real invoices from actual shipments and sends them to tyler@tygershark.com for validation.
 * Uses the existing invoice email template system with test mode enabled and real shipment data.
 */
exports.sendTestInvoiceEmail = onRequest(
    {
        cors: true,
        timeoutSeconds: 300,
        memory: '512MiB'
    },
    async (req, res) => {
        // Handle CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
            res.status(200).send('');
            return;
        }

        try {
            console.log('Starting test invoice email generation...');

            const { companyId, companyName, invoiceMode = 'separate', testEmail = 'tyler@tygershark.com', filters = {} } = req.body;
            
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }

            console.log(`Generating test invoice email for company: ${companyName || companyId}`);
            console.log(`Test email recipient: ${testEmail}`);
            console.log(`Invoice mode: ${invoiceMode}`);

            // 1. FETCH ACTUAL SHIPMENTS USING SAME LOGIC AS EMAIL FUNCTION (limited to 3 for testing)
            const shipments = await fetchFilteredShipments(companyId, filters, 3);

            if (shipments.length === 0) {
                return res.json({
                    success: true,
                    invoicesGenerated: 0,
                    message: 'No shipments found matching the specified criteria for test email'
                });
            }

            console.log(`Found ${shipments.length} actual shipments for test email`);

            // 2. GENERATE TEST INVOICES BASED ON MODE
            let invoicesGenerated = 0;

            if (invoiceMode === 'separate') {
                // SEPARATE MODE: Generate up to 3 individual test invoices
                console.log('Using SEPARATE invoice mode for test - generating individual invoices');
                
                for (const shipment of shipments.slice(0, 2)) { // Send max 2 for testing
                    try {
                        const realInvoiceData = await createInvoiceDataForShipment(shipment, companyId);
                        // Add TEST prefix to invoice number for identification
                        realInvoiceData.invoiceNumber = `TEST-${realInvoiceData.invoiceNumber}`;
                        await generateInvoicePDFAndEmailHelper(realInvoiceData, companyId, true, testEmail);
                        invoicesGenerated++;
                        console.log(`Successfully sent test invoice for real shipment ${shipment.shipmentID || shipment.id}`);
                    } catch (error) {
                        console.error(`Failed to send test invoice for shipment ${shipment.shipmentID || shipment.id}:`, error);
                    }
                }
            } else {
                // COMBINED MODE: Generate one combined test invoice
                console.log('Using COMBINED invoice mode for test - generating combined invoice');
                
                try {
                    const customerName = getCustomerName(shipments[0]) || 'Test Customer';
                    const realCombinedInvoiceData = await createCombinedInvoiceDataForCustomer(customerName, shipments, companyId);
                    // Add TEST prefix to invoice number for identification
                    realCombinedInvoiceData.invoiceNumber = `TEST-${realCombinedInvoiceData.invoiceNumber}`;
                    await generateInvoicePDFAndEmailHelper(realCombinedInvoiceData, companyId, true, testEmail);
                    invoicesGenerated = 1;
                    console.log(`Successfully sent combined test invoice for ${shipments.length} real shipments`);
                } catch (error) {
                    console.error('Failed to send combined test invoice:', error);
                }
            }

            console.log(`Test email generation completed: ${invoicesGenerated} invoices sent to ${testEmail}`);

            res.json({
                success: true,
                invoicesGenerated: invoicesGenerated,
                testEmail: testEmail,
                sampleShipments: shipments.length,
                invoiceMode: invoiceMode,
                message: `Successfully sent ${invoicesGenerated} test invoice${invoicesGenerated > 1 ? 's' : ''} to ${testEmail}`
            });

        } catch (error) {
            console.error('Error in test invoice email generation:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to generate and send test invoice email' 
            });
        }
    }
);

/**
 * Fetch filtered shipments using the same logic as email function (limited quantity for testing)
 */
async function fetchFilteredShipments(companyId, filters, limit = 3) {
    let baseQuery = db.collection('shipments')
        .where('companyID', '==', companyId)
        .where('status', '!=', 'draft')
        .limit(limit);

    // Apply date filters if provided
    if (filters.dateFrom || filters.dateTo) {
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            baseQuery = baseQuery.where('createdAt', '>=', fromDate);
        }
        
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setDate(toDate.getDate() + 1);
            baseQuery = baseQuery.where('createdAt', '<', toDate);
        }
    }

    // Apply status filter if provided
    if (filters.status) {
        baseQuery = baseQuery.where('status', '==', filters.status);
    }

    let shipments = [];

    if (filters.shipmentIds && filters.shipmentIds.length > 0) {
        // Use specific shipment IDs if provided (but still limit)
        const limitedIds = filters.shipmentIds.slice(0, limit);
        const batchQuery = baseQuery.where('shipmentID', 'in', limitedIds);
        const batchSnapshot = await batchQuery.get();
        shipments = batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
        // Get sample shipments
        const snapshot = await baseQuery.get();
        shipments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Apply customer filter if provided
    if (filters.customers && filters.customers.length > 0) {
        shipments = shipments.filter(shipment => {
            const customerID = shipment.shipTo?.customerID || shipment.customerID;
            return filters.customers.includes(customerID);
        });
    }

    return shipments.slice(0, limit); // Ensure we don't exceed limit
}

/**
 * Create invoice data for a single shipment (same as email function)
 */
async function createInvoiceDataForShipment(shipment, companyId) {
    const shipmentId = shipment.shipmentID || shipment.id;
    const sequentialInvoiceNumber = await getNextInvoiceNumber(companyId);
    const charges = getSimpleShipmentCharges(shipment);
    const currency = 'USD';

    const invoiceTotals = {
        subtotal: charges,
        tax: 0,
        total: charges
    };

    return {
        invoiceNumber: sequentialInvoiceNumber,
        companyID: companyId,
        customerId: shipment.shipTo?.customerID || shipment.customerID,
        
        lineItems: [{
            shipmentId: shipmentId,
            orderNumber: shipmentId,
            trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
            description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
            carrier: 'Integrated Carriers',
            service: shipment.service || 'Standard',
            date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
            charges: charges,
            packages: shipment.packages?.length || shipment.packageCount || 1,
            weight: calculateTotalWeight(shipment),
            weightUnit: shipment.weightUnit || 'lbs',
            shipFrom: shipment.shipFrom,
            shipTo: shipment.shipTo
        }],
        
        currency: currency,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentTerms: 'NET 30',
        
        subtotal: invoiceTotals.subtotal,
        tax: invoiceTotals.tax,
        total: invoiceTotals.total
    };
}

/**
 * Create combined invoice data for a customer (same as email function)
 */
async function createCombinedInvoiceDataForCustomer(customerName, customerShipments, companyId) {
    const sequentialInvoiceNumber = await getNextInvoiceNumber(companyId);
    const currency = 'USD';
    
    let totalCharges = 0;
    const lineItems = [];

    for (const shipment of customerShipments) {
        const shipmentId = shipment.shipmentID || shipment.id;
        const charges = getSimpleShipmentCharges(shipment);
        totalCharges += charges;

        lineItems.push({
            shipmentId: shipmentId,
            orderNumber: shipmentId,
            trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
            description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
            carrier: 'Integrated Carriers',
            service: shipment.service || 'Standard',
            date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
            charges: charges,
            packages: shipment.packages?.length || shipment.packageCount || 1,
            weight: calculateTotalWeight(shipment),
            weightUnit: shipment.weightUnit || 'lbs',
            shipFrom: shipment.shipFrom,
            shipTo: shipment.shipTo
        });
    }

    const invoiceTotals = {
        subtotal: totalCharges,
        tax: 0,
        total: totalCharges
    };

    return {
        invoiceNumber: sequentialInvoiceNumber,
        companyID: companyId,
        customerId: customerShipments[0]?.shipTo?.customerID || customerShipments[0]?.customerID,
        
        lineItems: lineItems,
        
        currency: currency,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentTerms: 'NET 30',
        
        subtotal: invoiceTotals.subtotal,
        tax: invoiceTotals.tax,
        total: invoiceTotals.total
    };
}

// Helper functions (reused from other invoice functions)
function getCustomerName(shipment) {
    return shipment.shipTo?.companyName ||
           shipment.shipTo?.name ||
           shipment.customerName ||
           shipment.companyName ||
           'Test Customer';
}

function getSimpleShipmentCharges(shipment) {
    try {
        if (shipment.markupRates?.totalCharges && shipment.markupRates.totalCharges > 0) {
            return parseFloat(shipment.markupRates.totalCharges) || 0;
        }
        
        if (shipment.billingDetails?.totalCharges && shipment.billingDetails.totalCharges > 0) {
            return parseFloat(shipment.billingDetails.totalCharges) || 0;
        }
        
        if (shipment.selectedRate?.totalCost && shipment.selectedRate.totalCost > 0) {
            return parseFloat(shipment.selectedRate.totalCost) || 0;
        }
        
        if (shipment.manualRates && Array.isArray(shipment.manualRates)) {
            const total = shipment.manualRates.reduce((sum, rate) => {
                return sum + (parseFloat(rate.cost) || 0);
            }, 0);
            if (total > 0) return total;
        }
        
        return 0; // Return 0 if no charges found (real data)
        
    } catch (error) {
        console.warn(`Error calculating charges for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return 0; // Return 0 for real data
    }
}

function calculateTotalWeight(shipment) {
    try {
        if (shipment.packages && Array.isArray(shipment.packages)) {
            return shipment.packages.reduce((total, pkg) => {
                const weight = parseFloat(pkg.weight) || 0;
                const quantity = parseInt(pkg.quantity) || 1;
                return total + (weight * quantity);
            }, 0);
        }
        
        return parseFloat(shipment.totalWeight) || 0; // Return actual weight or 0
    } catch (error) {
        console.warn(`Error calculating weight for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return 0; // Return 0 for real data
    }
} 