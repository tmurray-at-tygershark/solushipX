const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const orchestrator = require('./invoiceOrchestrator');

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
 * Email Bulk Invoices - Generates invoices and emails them to customers
 * Uses the existing invoice email template system from generateInvoicePDFAndEmail
 */
exports.emailBulkInvoices = onRequest(
    {
        cors: true,
        timeoutSeconds: 540,
        memory: '1GiB'
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

        console.log('🔥 emailBulkInvoices FUNCTION CALLED - STARTING EXECUTION');
        console.log('🔥 Request body received:', JSON.stringify(req.body, null, 2));

        try {
            console.log('Starting bulk invoice email generation...');

            const { companyId, companyName, invoiceMode = 'separate', invoiceIssueDate = null, invoiceNumberOverride = null, filters = {} } = req.body;
            
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }

            console.log(`Generating and emailing invoices for company: ${companyName || companyId}`);
            console.log(`Invoice mode: ${invoiceMode}`);
            console.log(`Applied filters:`, filters);

            // 1. FETCH SHIPMENTS USING SAME LOGIC AS BULK GENERATOR
            console.log('🔍 About to fetch shipments with:', { companyId, filters });
            const shipments = await fetchFilteredShipments(companyId, filters);
            console.log(`📋 Fetch result: Found ${shipments.length} shipments`);

            if (shipments.length === 0) {
                console.log('❌ No shipments found - returning early');
                return res.json({
                    success: true,
                    successCount: 0,
                    errorCount: 0,
                    message: 'No shipments found matching the specified criteria'
                });
            }

            console.log(`Found ${shipments.length} shipments for invoice email generation`);

            // 2-4. BUILD → GENERATE → DELIVER (OFFICIAL mode)
            const { invoiceDatas, companyInfo } = await orchestrator.buildInvoiceDatas({
                shipments,
                companyId,
                invoiceMode,
                invoiceIssueDate,
                invoiceNumberOverride,
                numberingOptions: { isOfficialSend: true }
            });

            const attachments = await orchestrator.generatePDFs({ invoiceDatas, companyInfo });

            // Official send: deliver to provided recipients if present, otherwise to customer billing via helper
            const { emailRecipients } = req.body;
            
            console.log('📧 Email recipients debug:', {
                emailRecipients,
                hasTo: emailRecipients?.to?.length > 0,
                hasCc: emailRecipients?.cc?.length > 0,
                hasBcc: emailRecipients?.bcc?.length > 0,
                toCount: emailRecipients?.to?.length || 0,
                ccCount: emailRecipients?.cc?.length || 0,
                bccCount: emailRecipients?.bcc?.length || 0
            });
            
            if (emailRecipients && (emailRecipients.to?.length || emailRecipients.cc?.length || emailRecipients.bcc?.length)) {
                console.log('✅ Using provided email recipients for delivery');
                console.log('📧 DELIVERY DEBUG - About to send via orchestrator.deliverInvoices:', {
                    attachmentCount: attachments.length,
                    invoiceCount: invoiceDatas.length,
                    recipientEmails: emailRecipients,
                    invoiceNumbers: invoiceDatas.map(inv => inv.invoiceNumber)
                });
                
                try {
                    await orchestrator.deliverInvoices({ companyId, recipients: emailRecipients, attachments, invoiceMode });
                    console.log('🎉 orchestrator.deliverInvoices completed - email should be sent');
                } catch (deliveryError) {
                    console.error('❌ orchestrator.deliverInvoices FAILED:', deliveryError.message);
                    throw deliveryError;
                }
            } else {
                console.log('⚠️ No email recipients provided, falling back to customer delivery');
                // Fallback: send each invoice via existing helper (customer delivery)
                let successCount = 0;
                let errorCount = 0;
                for (const inv of invoiceDatas) {
                    try {
                        console.log(`📧 Attempting customer delivery for invoice ${inv.invoiceNumber}`);
                        await require('../generateInvoicePDFAndEmail').generateInvoicePDFAndEmailHelper(inv, companyId, false, null);
                        successCount++;
                        console.log(`✅ Customer delivery successful for invoice ${inv.invoiceNumber}`);
                    } catch (e) {
                        console.error(`❌ Customer delivery failed for invoice ${inv.invoiceNumber}:`, e.message);
                        logger.error('Customer delivery failed', e);
                        errorCount++;
                    }
                }
                console.log(`📊 Customer delivery summary: ${successCount} successful, ${errorCount} failed`);
                return res.json({ success: true, successCount, errorCount, totalShipments: shipments.length, invoiceMode });
            }

            res.json({ success: true, successCount: attachments.length, errorCount: 0, totalShipments: shipments.length, invoiceMode });

        } catch (error) {
            console.error('Error in bulk invoice email generation:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to generate and email invoices' 
            });
        }
    }
);

/**
 * Fetch filtered shipments using the same logic as bulk generator
 */
async function fetchFilteredShipments(companyId, filters) {
    console.log('🔍 fetchFilteredShipments called with:', { companyId, filters });
    
    let baseQuery = db.collection('shipments')
        .where('companyID', '==', companyId)
        .where('status', '!=', 'draft');
    
    console.log('📊 Base query created for company:', companyId);

    // Apply date filters
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

    // Apply status filter
    if (filters.status) {
        baseQuery = baseQuery.where('status', '==', filters.status);
    }

    let shipments = [];

    if (filters.shipmentIds && filters.shipmentIds.length > 0) {
        // Specific shipment IDs mode
        console.log('🔍 Using specific shipmentIds query mode for:', filters.shipmentIds);
        const batches = [];
        for (let i = 0; i < filters.shipmentIds.length; i += 10) {
            const batch = filters.shipmentIds.slice(i, i + 10);
            batches.push(batch);
        }
        console.log(`📊 Created ${batches.length} batches for query`);

        for (const batch of batches) {
            console.log('🔍 Querying batch:', batch);
            const batchQuery = baseQuery.where('shipmentID', 'in', batch);
            const batchSnapshot = await batchQuery.get();
            console.log(`📊 Batch result: ${batchSnapshot.docs.length} docs`);
            shipments.push(...batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
    } else {
        // Normal filtering mode
        console.log('🔍 Using normal filtering mode');
        const snapshot = await baseQuery.get();
        shipments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`📊 Normal query result: ${shipments.length} shipments`);
    }

    // Apply customer filter (EXACT SAME AS TEST EMAIL AND PREVIEW - WORKING VERSION)
    if (filters.customers && filters.customers.length > 0) {
        console.log('🔍 Applying customer filter for:', filters.customers);
        console.log(`📊 Before customer filter: ${shipments.length} shipments`);
        
        const originalCount = shipments.length;
        const normalize = (v) => (v ? String(v).trim().toUpperCase() : null);
        const targets = filters.customers.map(normalize).filter(Boolean);

        const getCandidates = (s) => {
            const arr = [
                s?.shipTo?.customerID,
                s?.customerID,
                s?.shipFrom?.customerID,
                // Legacy variants
                s?.shipTo?.customerId,
                s?.shipFrom?.customerId,
                s?.shipTo?._rawData?.customerID,
                s?.shipFrom?._rawData?.customerID,
                s?.customerId,
                s?.customer?.id
            ];
            const norm = arr.map(normalize).filter(Boolean);
            return Array.from(new Set(norm));
        };

        shipments = shipments.filter(s => getCandidates(s).some(cid => targets.includes(cid)));

        console.log(`Customer filter reduced shipments from ${originalCount} to ${shipments.length}`);
    }

    console.log(`✅ fetchFilteredShipments final result: ${shipments.length} shipments`);
    return shipments;
}

/**
 * Create invoice data for a single shipment (separate mode)
 */
async function createInvoiceDataForShipment(shipment, companyId, invoiceIssueDate = null) {
    const shipmentId = shipment.shipmentID || shipment.id;
    const sequentialInvoiceNumber = await getNextInvoiceNumber(companyId);
    const charges = getSimpleShipmentCharges(shipment);
    const currency = 'USD'; // Default currency

    // Calculate tax (assume no tax items for now, can be enhanced)
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
        issueDate: invoiceIssueDate ? new Date(invoiceIssueDate) : new Date(),
        dueDate: invoiceIssueDate ? new Date(new Date(invoiceIssueDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentTerms: 'NET 30',
        
        subtotal: invoiceTotals.subtotal,
        tax: invoiceTotals.tax,
        total: invoiceTotals.total
    };
}

/**
 * Create combined invoice data for a customer (combined mode)
 */
async function createCombinedInvoiceDataForCustomer(customerName, customerShipments, companyId, invoiceIssueDate = null) {
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
        issueDate: invoiceIssueDate ? new Date(invoiceIssueDate) : new Date(),
        dueDate: invoiceIssueDate ? new Date(new Date(invoiceIssueDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
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
           'Unknown Customer';
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
        
        return 0;
        
    } catch (error) {
        console.warn(`Error calculating charges for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return 0;
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
        
        return parseFloat(shipment.totalWeight) || 0;
    } catch (error) {
        console.warn(`Error calculating weight for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return 0;
    }
} 