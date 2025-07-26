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

// Import the existing invoice generation functions
const { generateInvoicePDF, getNextInvoiceNumber } = require('../generateInvoicePDFAndEmail');

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

            const { companyId, companyName, invoiceMode = 'separate', invoiceIssueDate = null, filters = {} } = req.body;
            
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

            // 2. GROUP SHIPMENTS BY CUSTOMER
            const customerGroups = {};
            let totalAmount = 0;
            let invoiceCount = 0;
            let lineItemCount = 0;

            for (const shipment of shipments) {
                const customerName = getCustomerName(shipment);
                if (!customerGroups[customerName]) {
                    customerGroups[customerName] = [];
                }
                customerGroups[customerName].push(shipment);
            }

            // 3. GENERATE ALL INVOICE PDFS FOR COMPLETE PREVIEW
            const sampleInvoices = [];

            // Get company info for PDF generation
            const companyInfo = await getCompanyInfo(companyId);
            
            if (invoiceMode === 'separate') {
                // SEPARATE MODE: One invoice per shipment
                invoiceCount = shipments.length;
                lineItemCount = shipments.length;

                // Generate actual PDFs for ALL shipments
                for (const shipment of shipments) {
                    try {
                        const invoiceData = await createInvoiceDataForShipment(shipment, companyId, invoiceIssueDate);
                        const pdfBuffer = await generateInvoicePDF(invoiceData, companyInfo);
                        
                        const charges = getSimpleShipmentCharges(shipment);
                        const customerName = getCustomerName(shipment);
                        const shipmentId = shipment.shipmentID || shipment.id;
                        
                        totalAmount += charges;
                        
                        sampleInvoices.push({
                            invoiceId: invoiceData.invoiceNumber,
                            customerName: customerName,
                            shipmentId: shipmentId,
                            totalAmount: charges,
                            lineItems: 1,
                            pdfBase64: pdfBuffer.toString('base64'), // ✅ NEW: Include actual PDF
                            fileName: `Invoice-${invoiceData.invoiceNumber}.pdf`
                        });
                    } catch (error) {
                        console.error(`Failed to generate preview PDF for shipment ${shipment.shipmentID || shipment.id}:`, error);
                        // Still include in list without PDF
                        const charges = getSimpleShipmentCharges(shipment);
                        const customerName = getCustomerName(shipment);
                        const shipmentId = shipment.shipmentID || shipment.id;
                        
                        totalAmount += charges;
                        
                        sampleInvoices.push({
                            invoiceId: `PREVIEW-${companyId}-${shipmentId}`,
                            customerName: customerName,
                            shipmentId: shipmentId,
                            totalAmount: charges,
                            lineItems: 1,
                            error: 'Failed to generate PDF preview'
                        });
                    }
                }
            } else {
                // COMBINED MODE: One invoice per customer
                invoiceCount = Object.keys(customerGroups).length;
                lineItemCount = shipments.length;

                // Generate actual PDFs for ALL customers
                for (const [customerName, customerShipments] of Object.entries(customerGroups)) {
                    
                    try {
                        const invoiceData = await createCombinedInvoiceDataForCustomer(customerName, customerShipments, companyId, invoiceIssueDate);
                        const pdfBuffer = await generateInvoicePDF(invoiceData, companyInfo);
                        
                        let customerTotal = 0;
                        for (const shipment of customerShipments) {
                            customerTotal += getSimpleShipmentCharges(shipment);
                        }
                        
                        totalAmount += customerTotal;
                        
                        sampleInvoices.push({
                            invoiceId: invoiceData.invoiceNumber,
                            customerName: customerName,
                            shipmentId: `${customerShipments.length} shipments`,
                            totalAmount: customerTotal,
                            lineItems: customerShipments.length,
                            pdfBase64: pdfBuffer.toString('base64'), // ✅ NEW: Include actual PDF
                            fileName: `Invoice-${invoiceData.invoiceNumber}.pdf`
                        });
                    } catch (error) {
                        console.error(`Failed to generate preview PDF for customer ${customerName}:`, error);
                        // Still include in list without PDF
                        let customerTotal = 0;
                        for (const shipment of customerShipments) {
                            customerTotal += getSimpleShipmentCharges(shipment);
                        }
                        
                        totalAmount += customerTotal;
                        
                        sampleInvoices.push({
                            invoiceId: `PREVIEW-${companyId}-${customerName.replace(/\s+/g, '').toUpperCase()}`,
                            customerName: customerName,
                            shipmentId: `${customerShipments.length} shipments`,
                            totalAmount: customerTotal,
                            lineItems: customerShipments.length,
                            error: 'Failed to generate PDF preview'
                        });
                    }
                }
            }

            const previewResult = {
                success: true,
                totalShipments: shipments.length,
                totalInvoices: invoiceCount,
                totalLineItems: lineItemCount,
                totalAmount: totalAmount,
                sampleInvoices: sampleInvoices,
                invoiceMode: invoiceMode,
                companyName: companyName,
                filters: filters
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
        issueDate: invoiceIssueDate ? new Date(invoiceIssueDate) : new Date(),
        dueDate: invoiceIssueDate ? new Date(new Date(invoiceIssueDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentTerms: 'NET 30',
        
        subtotal: invoiceTotals.subtotal,
        tax: invoiceTotals.tax,
        total: invoiceTotals.total
    };
}

/**
 * Create combined invoice data for a customer (same as email function)
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

// Helper function to get simple charges (reused from bulk generator)
function getSimpleShipmentCharges(shipment) {
    try {
        // Try multiple data sources for charges in order of preference
        
        // 1. markupRates (customer-facing charges with markup)
        if (shipment.markupRates?.totalCharges && shipment.markupRates.totalCharges > 0) {
            return parseFloat(shipment.markupRates.totalCharges) || 0;
        }
        
        // 2. billingDetails (manual or adjusted charges)
        if (shipment.billingDetails?.totalCharges && shipment.billingDetails.totalCharges > 0) {
            return parseFloat(shipment.billingDetails.totalCharges) || 0;
        }
        
        // 3. selectedRate total cost
        if (shipment.selectedRate?.totalCost && shipment.selectedRate.totalCost > 0) {
            return parseFloat(shipment.selectedRate.totalCost) || 0;
        }
        
        // 4. QuickShip manual rates total
        if (shipment.manualRates && Array.isArray(shipment.manualRates)) {
            const total = shipment.manualRates.reduce((sum, rate) => {
                return sum + (parseFloat(rate.cost) || 0);
            }, 0);
            if (total > 0) return total;
        }
        
        // 5. Fallback to 0 if no charges found
        return 0;
        
    } catch (error) {
        console.warn(`Error calculating charges for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return 0;
    }
} 