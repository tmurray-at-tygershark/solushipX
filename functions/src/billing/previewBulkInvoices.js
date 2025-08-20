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

// Use orchestrator for consistent build/generate across preview/test/official
const orchestrator = require('./invoiceOrchestrator');
const { PDFDocument } = require('pdf-lib');
const { detectSimpleCurrency } = require('./bulkInvoiceGenerator');

/**
 * Preview Bulk Invoices - Generates actual PDF invoices for preview
 * This function processes the same filtering logic as generateBulkInvoices and generates
 * actual PDF files that can be viewed in the preview modal
 */
exports.previewBulkInvoices = onRequest(
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
            console.log('Starting invoice preview generation...');

            const { companyId, companyName, invoiceMode = 'separate', invoiceIssueDate = null, invoiceNumberOverride = null, filters = {} } = req.body;
            
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }

            console.log(`Generating preview for company: ${companyName || companyId}`);
            console.log(`Invoice mode: ${invoiceMode}`);
            console.log(`Applied filters:`, filters);

            // 1. BUILD DYNAMIC QUERY WITH ALL FILTERS (same as bulk generator)
            let baseQuery = db.collection('shipments')
                .where('companyID', '==', companyId)
                .where('status', '!=', 'draft');

            // Apply date filters if provided
            if (filters.dateFrom || filters.dateTo) {
                console.log(`Applying date filters: ${filters.dateFrom} to ${filters.dateTo}`);
                
                if (filters.dateFrom) {
                    const fromDate = new Date(filters.dateFrom);
                    baseQuery = baseQuery.where('createdAt', '>=', fromDate);
                }
                
                if (filters.dateTo) {
                    const toDate = new Date(filters.dateTo);
                    // Add 1 day to include the entire end date
                    toDate.setDate(toDate.getDate() + 1);
                    baseQuery = baseQuery.where('createdAt', '<', toDate);
                }
            }

            // Apply status filter if provided
            if (filters.status) {
                console.log(`Applying status filter: ${filters.status}`);
                baseQuery = baseQuery.where('status', '==', filters.status);
            }

            let shipments = [];

            if (filters.shipmentIds && filters.shipmentIds.length > 0) {
                // SPECIFIC SHIPMENT IDs MODE
                console.log(`Filtering by ${filters.shipmentIds.length} specific shipment IDs`);
                
                const batches = [];
                for (let i = 0; i < filters.shipmentIds.length; i += 10) {
                    const batch = filters.shipmentIds.slice(i, i + 10);
                    batches.push(batch);
                }

                for (const batch of batches) {
                    const batchQuery = baseQuery.where('shipmentID', 'in', batch);
                    const batchSnapshot = await batchQuery.get();
                    shipments.push(...batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }
            } else {
                // NORMAL FILTERING MODE
                const snapshot = await baseQuery.get();
                shipments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            console.log(`Found ${shipments.length} shipments for preview`);

            if (shipments.length === 0) {
                return res.json({
                    success: true,
                    totalShipments: 0,
                    totalInvoices: 0,
                    totalLineItems: 0,
                    totalAmount: 0,
                    sampleInvoices: [],
                    message: 'No shipments found matching the specified criteria'
                });
            }

            // Apply customer filter if provided
            if (filters.customers && filters.customers.length > 0) {
                console.log(`Applying customer filter: ${filters.customers.length} customers`);
                shipments = shipments.filter(shipment => {
                    const customerID = shipment.shipTo?.customerID || shipment.customerID;
                    return filters.customers.includes(customerID);
                });
                console.log(`After customer filtering: ${shipments.length} shipments`);
            }

            // 2. Build exactly like test/official, but PEEK invoice numbers (no reservation)
            const { invoiceDatas, companyInfo } = await orchestrator.buildInvoiceDatas({
                shipments,
                companyId,
                invoiceMode,
                invoiceIssueDate,
                invoiceNumberOverride,
                numberingOptions: { useOfficialForTest: true }
            });

            const attachments = await orchestrator.generatePDFs({ invoiceDatas, companyInfo });

            // Derive recipients from BILL TO of built invoices
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const splitEmails = (v) => Array.isArray(v)
                ? v
                : String(v || '')
                    .split(/[;,]/)
                    .map(s => s.trim())
                    .filter(Boolean);
            const recipSet = new Set();
            for (const inv of invoiceDatas) {
                const billTo = inv.billTo || {};
                const candidates = [
                    ...splitEmails(billTo.billingEmail),
                    ...splitEmails(billTo.email),
                    ...splitEmails(billTo?.billingInfo?.email)
                ];
                candidates.forEach(e => { if (emailRegex.test(e)) recipSet.add(e.toLowerCase()); });
            }
            const recipients = { to: Array.from(recipSet) };

            // Merge into a single combined PDF for easy viewing
            let combinedPdfBase64 = null;
            try {
                const merged = await PDFDocument.create();
                for (const att of attachments) {
                    if (!att?.content) continue;
                    const srcBytes = Buffer.from(att.content, 'base64');
                    const srcDoc = await PDFDocument.load(srcBytes);
                    const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
                    pages.forEach(p => merged.addPage(p));
                }
                const mergedBytes = await merged.save();
                combinedPdfBase64 = Buffer.from(mergedBytes).toString('base64');
            } catch (mergeErr) {
                console.warn('Preview merge error (fallback to individual PDFs):', mergeErr);
            }

            const sampleInvoices = attachments.map(att => ({
                invoiceId: att.invoiceData.invoiceNumber,
                customerName: att.invoiceData.companyName,
                shipmentId: att.invoiceData.lineItems.length === 1 ? att.invoiceData.lineItems[0].shipmentId : `${att.invoiceData.lineItems.length} shipments`,
                totalAmount: att.invoiceData.total,
                lineItems: att.invoiceData.lineItems.length,
                pdfBase64: att.content,
                fileName: att.filename
            }));

            const totalAmount = invoiceDatas.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
            const invoiceCount = invoiceDatas.length;
            const lineItemCount = invoiceDatas.reduce((sum, inv) => sum + inv.lineItems.length, 0);

            const previewResult = {
                success: true,
                totalShipments: shipments.length,
                totalInvoices: invoiceCount,
                totalLineItems: lineItemCount,
                totalAmount: totalAmount,
                sampleInvoices,
                invoiceMode,
                companyName,
                filters,
                combinedPdfBase64,
                combinedFileName: `Preview_Invoices_${Date.now()}.pdf`,
                recipients
            };

            console.log(`Preview generated: ${invoiceCount} invoices for ${shipments.length} shipments, $${totalAmount.toFixed(2)} total`);

            res.json(previewResult);

        } catch (error) {
            console.error('Error generating invoice preview:', error);
            res.status(500).json({ 
                error: error.message,
                details: 'Failed to generate invoice preview' 
            });
        }
    }
);

// Helper function to get customer name from shipment
function getCustomerName(shipment) {
    return shipment.shipTo?.companyName ||
           shipment.shipTo?.name ||
           shipment.customerName ||
           shipment.companyName ||
           'Unknown Customer';
}

/**
 * Get company information for PDF generation
 */
async function getCompanyInfo(companyId) {
    try {
        const companyDoc = await db.collection('companies').where('companyID', '==', companyId).limit(1).get();
        
        if (!companyDoc.empty) {
            const companyData = companyDoc.docs[0].data();
            return {
                companyID: companyId,
                name: companyData.name || companyData.companyName || companyId,
                logoUrl: companyData.logoUrl || companyData.logo,
                billingAddress: companyData.billingAddress || {},
                mainContact: companyData.mainContact || {},
                ...companyData
            };
        }
        
        // Fallback company info
        return {
            companyID: companyId,
            name: companyId,
            logoUrl: null,
            billingAddress: {},
            mainContact: {}
        };
    } catch (error) {
        console.error('Error fetching company info:', error);
        return {
            companyID: companyId,
            name: companyId,
            logoUrl: null,
            billingAddress: {},
            mainContact: {}
        };
    }
}

/**
 * Create invoice data for a single shipment (same as email function)
 */
async function createInvoiceDataForShipment(shipment, companyId, invoiceIssueDate = null) {
    const shipmentId = shipment.shipmentID || shipment.id;
    const sequentialInvoiceNumber = await getNextInvoiceNumber(companyId);
    const charges = getSimpleShipmentCharges(shipment);
    const currency = detectSimpleCurrency([shipment]);

    // Get detailed charge breakdown for tax calculation
    const chargeBreakdown = getSimpleChargeBreakdown(shipment, charges, currency);
    
    // Calculate proper tax separation
    const invoiceTotals = calculateInvoiceTotals(chargeBreakdown);

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
            shipTo: shipment.shipTo,
            // 🔍 NEW: All reference numbers for comprehensive invoice display
            allReferenceNumbers: getAllReferenceNumbers(shipment)
        }],
        
        currency: currency,
        issueDate: invoiceIssueDate ? new Date(invoiceIssueDate) : new Date(),
        dueDate: invoiceIssueDate ? new Date(new Date(invoiceIssueDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentTerms: 'NET 30',
        
        subtotal: invoiceTotals.subtotal,
        tax: invoiceTotals.tax,
        total: invoiceTotals.total,
        // 🍁 NEW: Quebec tax breakdown support
        taxBreakdown: invoiceTotals.taxBreakdown,
        hasQuebecTaxes: invoiceTotals.hasQuebecTaxes
    };
}

/**
 * Create combined invoice data for a customer (same as email function)
 */
async function createCombinedInvoiceDataForCustomer(customerName, customerShipments, companyId, invoiceIssueDate = null) {
    const sequentialInvoiceNumber = await getNextInvoiceNumber(companyId);
    const currency = detectSimpleCurrency(customerShipments);
    
    let totalCharges = 0;
    const lineItems = [];
    const allChargeBreakdowns = [];

    for (const shipment of customerShipments) {
        const shipmentId = shipment.shipmentID || shipment.id;
        const charges = getSimpleShipmentCharges(shipment);
        totalCharges += charges;

        // Get detailed charge breakdown for tax calculation
        const chargeBreakdown = getSimpleChargeBreakdown(shipment, charges, currency);
        allChargeBreakdowns.push(...chargeBreakdown);

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
            shipTo: shipment.shipTo,
            // 🔍 NEW: All reference numbers for comprehensive invoice display
            allReferenceNumbers: getAllReferenceNumbers(shipment)
        });
    }

    // Calculate proper tax separation across all combined shipments
    const invoiceTotals = calculateInvoiceTotals(allChargeBreakdowns);

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


 