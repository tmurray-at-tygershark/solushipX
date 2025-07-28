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

// Import helper functions from ZIP generator for EXACT SAME LOGIC
const { 
    getSimpleShipmentCharges, 
    getSimpleChargeBreakdown, 
    calculateInvoiceTotals, 
    detectSimpleCurrency,
    calculateTotalWeight,
    getActualCustomerName,
    getCustomerBillingInfo
} = require('./bulkInvoiceGenerator');

// Import email template functions from the real invoice email system
const { 
    generateInvoicePDF,
    generateInvoiceEmailHTML,
    generateInvoiceEmailText
} = require('../generateInvoicePDFAndEmail');

/**
 * Send Invoice Email - Generates real invoices from actual shipments and sends them to specified email for validation.
 * Uses the existing invoice email template system with real shipment data and real invoice numbers.
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
            console.log('Starting invoice email generation...');

            const { companyId, companyName, invoiceMode = 'separate', invoiceIssueDate = null, testEmails = { to: ['tyler@tygershark.com'], cc: [], bcc: [] }, filters = {} } = req.body;
            
            if (!companyId) {
                return res.status(400).json({ error: 'Company ID required' });
            }

            console.log(`Generating invoice email for company: ${companyName || companyId}`);
            console.log(`Email recipients - To: ${testEmails.to.join(', ')}, CC: ${testEmails.cc.join(', ')}, BCC: ${testEmails.bcc.join(', ')}`);
            console.log(`Invoice mode: ${invoiceMode}`);

            // 1. FETCH ACTUAL SHIPMENTS USING EXACT SAME LOGIC AS ZIP GENERATOR (NO LIMITS - EXACT SAME AS CUSTOMER EMAILS)
            const shipments = await fetchFilteredShipments(companyId, filters);

            if (shipments.length === 0) {
                return res.json({
                    success: true,
                    invoicesGenerated: 0,
                    message: 'No shipments found matching the specified criteria'
                });
            }

            console.log(`Found ${shipments.length} actual shipments for invoice generation`);

            // 2. GENERATE INVOICES BASED ON MODE (EXACT SAME AS ZIP GENERATOR)
            let invoicesGenerated = 0;
            const allInvoicePDFs = []; // Store all PDFs for single email

            // DETECT CURRENCY (EXACT SAME AS ZIP GENERATOR)
            const currency = detectSimpleCurrency(shipments);
            
            if (invoiceMode === 'separate') {
                // SEPARATE MODE: Generate ALL individual invoices (EXACT SAME AS ZIP GENERATOR)
                console.log('Using SEPARATE invoice mode - generating ALL individual invoices');
                
                // Group shipments by customer (EXACT SAME AS ZIP GENERATOR)
                const customerGroups = {};
                for (const shipment of shipments) {
                    const customerName = await getActualCustomerName(shipment, companyId);
                    if (!customerGroups[customerName]) {
                        customerGroups[customerName] = [];
                    }
                    customerGroups[customerName].push(shipment);
                }

                // Generate invoices for each customer (EXACT SAME AS ZIP GENERATOR)
                for (const [customerName, customerShipments] of Object.entries(customerGroups)) {
                    for (const shipment of customerShipments) {
                        try {
                            // Get customer billing information (EXACT SAME AS ZIP GENERATOR)
                            const companyInfo = await getCustomerBillingInfo(shipment, companyId);
                            
                            const realInvoiceData = await createInvoiceDataForShipment(shipment, companyId, customerName, currency, companyInfo, invoiceIssueDate);
                            
                            const pdfBuffer = await generateInvoicePDF(realInvoiceData, companyInfo);
                            
                            allInvoicePDFs.push({
                                content: pdfBuffer.toString('base64'),
                                filename: `Invoice_${realInvoiceData.invoiceNumber}.pdf`,
                                type: 'application/pdf',
                                disposition: 'attachment',
                                invoiceData: realInvoiceData // Store for email template
                            });
                            
                            invoicesGenerated++;
                            console.log(`Successfully generated invoice PDF for shipment ${shipment.shipmentID || shipment.id}`);
                        } catch (error) {
                            console.error(`Failed to generate invoice for shipment ${shipment.shipmentID || shipment.id}:`, error);
                        }
                    }
                }
            } else {
                // COMBINED MODE: Generate one combined invoice (EXACT SAME AS ZIP GENERATOR)
                console.log('Using COMBINED invoice mode - generating combined invoice');
                
                try {
                    const customerName = await getActualCustomerName(shipments[0], companyId);
                    
                    // Get customer billing info from first shipment (same for all shipments from same customer)
                    const companyInfo = await getCustomerBillingInfo(shipments[0], companyId);
                    
                                            const realCombinedInvoiceData = await createCombinedInvoiceDataForCustomer(customerName, shipments, companyId, currency, companyInfo, invoiceIssueDate);
                    
                    const pdfBuffer = await generateInvoicePDF(realCombinedInvoiceData, companyInfo);
                    
                    allInvoicePDFs.push({
                        content: pdfBuffer.toString('base64'),
                        filename: `Combined_Invoice_${realCombinedInvoiceData.invoiceNumber}.pdf`,
                        type: 'application/pdf',
                        disposition: 'attachment',
                        invoiceData: realCombinedInvoiceData // Store for email template
                    });
                    
                    invoicesGenerated = 1;
                    console.log(`Successfully generated combined invoice PDF for ${shipments.length} shipments`);
                } catch (error) {
                    console.error('Failed to generate combined invoice:', error);
                }
            }

            // 3. SEND SINGLE EMAIL WITH ALL INVOICES ATTACHED (EXACT SAME TEMPLATE AS CUSTOMER EMAILS)
            if (allInvoicePDFs.length > 0) {
                try {
                    await sendTestEmailWithAllInvoices(allInvoicePDFs, companyId, testEmails, invoiceMode, invoicesGenerated);
                    console.log(`Successfully sent invoice email with ${allInvoicePDFs.length} invoice PDFs attached`);
                } catch (error) {
                    console.error('Failed to send invoice email:', error);
                    throw error;
                }
            }

            const totalRecipients = testEmails.to.length + testEmails.cc.length + testEmails.bcc.length;
            console.log(`Test email generation completed: ${invoicesGenerated} invoices sent to ${totalRecipients} recipients`);

            res.json({
                success: true,
                invoicesGenerated: invoicesGenerated,
                testEmails: testEmails,
                sampleShipments: shipments.length,
                invoiceMode: invoiceMode,
                message: `Successfully sent ${invoicesGenerated} test invoice${invoicesGenerated > 1 ? 's' : ''} to ${totalRecipients} recipient${totalRecipients > 1 ? 's' : ''}`
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
async function fetchFilteredShipments(companyId, filters) {
    let shipments = [];

    // EXACT SAME LOGIC AS ZIP GENERATOR
    if (filters.shipmentIds && filters.shipmentIds.length > 0) {
        // SPECIFIC SHIPMENT IDS MODE (with date/status filtering)
        console.log(`Processing ${filters.shipmentIds.length} specific shipment IDs`);
        
        // Split into batches of 10 for Firestore 'in' query limit
        const batches = [];
        for (let i = 0; i < filters.shipmentIds.length; i += 10) {
            const batch = filters.shipmentIds.slice(i, i + 10);
            batches.push(batch);
        }

        // Execute all batches in parallel with additional filters
        const batchPromises = batches.map(batch => {
            let batchQuery = db.collection('shipments')
                .where('companyID', '==', companyId)
                .where('shipmentID', 'in', batch)
                .where('status', '!=', 'draft');

            // Apply date filters to each batch
            if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                batchQuery = batchQuery.where('createdAt', '>=', fromDate);
            }
            
            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                toDate.setDate(toDate.getDate() + 1);
                batchQuery = batchQuery.where('createdAt', '<', toDate);
            }

            // Apply status filter to each batch
            if (filters.status) {
                batchQuery = batchQuery.where('status', '==', filters.status);
            }

            return batchQuery.get();
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Combine all results
        batchResults.forEach(snapshot => {
            snapshot.docs.forEach(doc => {
                shipments.push({ id: doc.id, ...doc.data() });
            });
        });

        console.log(`Found ${shipments.length} shipments matching specific IDs with additional filters`);

    } else {
        // ALL SHIPMENTS MODE (with date/status filtering)
        let baseQuery = db.collection('shipments')
            .where('companyID', '==', companyId)
            .where('status', '!=', 'draft');

        // Apply date filters
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            baseQuery = baseQuery.where('createdAt', '>=', fromDate);
        }
        
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setDate(toDate.getDate() + 1);
            baseQuery = baseQuery.where('createdAt', '<', toDate);
        }

        // Apply status filter
        if (filters.status) {
            baseQuery = baseQuery.where('status', '==', filters.status);
        }

        const shipmentsSnapshot = await baseQuery.get();
        shipments = shipmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log(`Found ${shipments.length} total shipments for ${companyId} with date/status filters`);
    }

    // 2. CUSTOMER FILTERING (EXACT SAME AS ZIP GENERATOR)
    if (filters.customers && filters.customers.length > 0) {
        console.log(`Filtering by ${filters.customers.length} specific customers`);
        
        const originalCount = shipments.length;
        shipments = shipments.filter(shipment => {
            // Check multiple customer ID fields
            const customerMatches = [
                shipment.shipTo?.customerID,
                shipment.customerID,
                shipment.shipFrom?.customerID
            ].some(customerId => filters.customers.includes(customerId));

            return customerMatches;
        });

        console.log(`Customer filter reduced shipments from ${originalCount} to ${shipments.length}`);
    }

    // 3. VALIDATE CHARGES (EXACT SAME AS ZIP GENERATOR)
    const validShipments = shipments.filter(shipment => {
        const charges = getSimpleShipmentCharges(shipment);
        return charges > 0;
    });

    console.log(`${validShipments.length} shipments have valid charges (${shipments.length - validShipments.length} filtered out)`);

    if (validShipments.length === 0) {
        throw new Error('No shipments with valid charges found for test email');
    }

    return validShipments;
}

/**
 * Create invoice data for a single shipment (EXACT SAME AS ZIP GENERATOR)
 */
async function createInvoiceDataForShipment(shipment, companyId, customerName, currency, companyInfo, invoiceIssueDate = null) {
    const charges = getSimpleShipmentCharges(shipment);
    const shipmentId = shipment.shipmentID || shipment.id;
    
    console.log(`Generating PDF for shipment ${shipmentId} (${charges} ${currency})...`);

    // ✅ UPDATED: Use sequential invoice numbering (NO PARAMETERS - EXACT SAME AS ZIP GENERATOR)
    const sequentialInvoiceNumber = await getNextInvoiceNumber();

    // Get detailed charge breakdown for tax calculation
    const chargeBreakdown = getSimpleChargeBreakdown(shipment, charges, currency);
    
    // Calculate proper tax separation
    const invoiceTotals = calculateInvoiceTotals(chargeBreakdown);
    
    // Use filtered total instead of raw charges (excludes transaction fees)
    const filteredCharges = invoiceTotals.total;
    
    // Create invoice data for this single shipment
    const invoiceData = {
        invoiceNumber: sequentialInvoiceNumber, // ✅ CHANGED: From `INV-${shipmentId}` to sequential number
        companyId: companyId,
        companyName: companyInfo.companyName || customerName || companyId,
        
        // Single line item for this shipment
        lineItems: [{
            shipmentId: shipmentId,
            orderNumber: shipmentId,
            trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
            description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
            carrier: 'Integrated Carriers', // Override carrier for customer invoices
            service: shipment.service || 'Standard',
            date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
            charges: filteredCharges, // Use filtered amount (excludes transaction fees)
            chargeBreakdown: chargeBreakdown,
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
        
        // ✅ UPDATED: Proper tax separation using the new calculation system with Quebec breakdown
        subtotal: invoiceTotals.subtotal,  // Total of non-tax items
        tax: invoiceTotals.tax,           // Total of tax items
        total: invoiceTotals.total,       // Subtotal + tax
        // 🍁 NEW: Quebec tax breakdown support
        taxBreakdown: invoiceTotals.taxBreakdown,
        hasQuebecTaxes: invoiceTotals.hasQuebecTaxes
    };

    return invoiceData;
}

/**
 * Create combined invoice data for a customer (EXACT SAME AS ZIP GENERATOR)
 */
async function createCombinedInvoiceDataForCustomer(customerName, customerShipments, companyId, currency, companyInfo, invoiceIssueDate = null) {
    // Calculate totals for all shipments for this customer
    let totalCharges = 0;
    const lineItems = [];
    const allChargeBreakdowns = [];

    // Process all shipments for this customer
    for (const shipment of customerShipments) {
        const charges = getSimpleShipmentCharges(shipment);
        const shipmentId = shipment.shipmentID || shipment.id;

        // Get detailed charge breakdown for this shipment
        const chargeBreakdown = getSimpleChargeBreakdown(shipment, charges, currency);
        allChargeBreakdowns.push(...chargeBreakdown);
        
        // Calculate filtered total for this shipment (excludes transaction fees)
        const shipmentTotals = calculateInvoiceTotals(chargeBreakdown);
        const filteredCharges = shipmentTotals.total;
        
        console.log(`Adding shipment ${shipmentId} (raw: ${charges} ${currency}, filtered: ${filteredCharges} ${currency}) to combined invoice...`);

        // Add this shipment as a line item
        lineItems.push({
            shipmentId: shipmentId,
            orderNumber: shipmentId,
            trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
            description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
            carrier: 'Integrated Carriers', // Override carrier for customer invoices
            service: shipment.service || 'Standard',
            date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
            charges: filteredCharges, // Use filtered amount (excludes transaction fees)
            chargeBreakdown: chargeBreakdown,
            packages: shipment.packages?.length || shipment.packageCount || 1,
            weight: calculateTotalWeight(shipment),
            weightUnit: shipment.weightUnit || 'lbs',
            shipFrom: shipment.shipFrom,
            shipTo: shipment.shipTo
        });

        totalCharges += filteredCharges;
    }

    const sequentialInvoiceNumber = await getNextInvoiceNumber();

    // ✅ UPDATED: Calculate proper tax separation across all shipments
    const combinedInvoiceTotals = calculateInvoiceTotals(allChargeBreakdowns);

    // Create combined invoice data
    const invoiceData = {
        invoiceNumber: sequentialInvoiceNumber, // ✅ CHANGED: From complex naming to sequential number
        companyId: companyId,
        companyName: companyInfo?.companyName || customerName || companyId,
        
        // ✅ MULTIPLE LINE ITEMS: All shipments for this customer
        lineItems: lineItems,
        
        currency: currency,
        issueDate: invoiceIssueDate ? new Date(invoiceIssueDate) : new Date(),
        dueDate: invoiceIssueDate ? new Date(new Date(invoiceIssueDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentTerms: 'NET 30',
        
        // ✅ UPDATED: Proper tax separation across all combined shipments with Quebec breakdown
        subtotal: combinedInvoiceTotals.subtotal,  // Total of non-tax items
        tax: combinedInvoiceTotals.tax,           // Total of tax items  
        total: combinedInvoiceTotals.total,       // Subtotal + tax
        // 🍁 NEW: Quebec tax breakdown support
        taxBreakdown: combinedInvoiceTotals.taxBreakdown,
        hasQuebecTaxes: combinedInvoiceTotals.hasQuebecTaxes
    };

    console.log(`Generated combined invoice ${sequentialInvoiceNumber} for ${customerName}: $${totalCharges} ${currency} (${lineItems.length} shipments)`);

    return invoiceData;
}

// Helper functions (reused from other invoice functions)
function getCustomerName(shipment) {
    return shipment.shipTo?.companyName ||
           shipment.shipTo?.name ||
           shipment.customerName ||
           shipment.companyName ||
           'Test Customer';
}

/**
 * Get company information (EXACT SAME AS ZIP GENERATOR)
 */
async function getCompanyInfo(companyId) {
    try {
        const companyDoc = await db.collection('companies').where('companyID', '==', companyId).get();
        if (companyDoc.empty) {
            throw new Error(`Company not found: ${companyId}`);
        }
        
        const company = companyDoc.docs[0].data();
        return {
            name: company.name,
            companyID: company.companyID,
            address: {
                street: company.address1 || company.street,
                city: company.city,
                state: company.state || company.stateProv,
                postalCode: company.postalCode || company.zipPostal,
                country: company.country
            },
            phone: company.phone,
            email: company.email,
            billingAddress: {
                address1: company.billingAddress1 || company.address1,
                city: company.billingCity || company.city,
                stateProv: company.billingState || company.state || company.stateProv,
                zipPostal: company.billingPostalCode || company.postalCode || company.zipPostal,
                country: company.billingCountry || company.country,
                email: company.billingEmail || company.email
            }
        };
    } catch (error) {
        console.error(`Error getting company info for ${companyId}:`, error);
        throw error;
    }
}

/**
 * Send single test email with all invoice PDFs attached (EXACT SAME TEMPLATE AS CUSTOMER EMAILS)
 */
async function sendTestEmailWithAllInvoices(allInvoicePDFs, companyId, testEmails, invoiceMode, invoicesGenerated) {
    try {
        const companyInfo = await getCompanyInfo(companyId);
        const sgMail = require('@sendgrid/mail');
        
        // Configure SendGrid with fallback to Firebase config
        const functions = require('firebase-functions');
        const sendgridApiKey = process.env.SENDGRID_API_KEY || functions.config().sendgrid?.api_key;
        if (!sendgridApiKey) {
            throw new Error('SendGrid API key not found in environment variables or Firebase config');
        }
        sgMail.setApiKey(sendgridApiKey);

        // Format currency helper (EXACT SAME AS CUSTOMER EMAILS)
        const formatCurrency = (amount, currency = 'USD') => {
            const formatted = parseFloat(amount).toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            return `${currency} $${formatted}`;
        };

        // Use REAL invoice data for email template (EXACT SAME AS CUSTOMER EMAILS)
        const firstInvoiceData = allInvoicePDFs[0]?.invoiceData || {
            invoiceNumber: `INV-MULTI`,
            companyId: companyId,
            lineItems: [],
            currency: 'CAD',
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paymentTerms: 'NET 30',
            subtotal: 0,
            tax: 0,
            total: 0
        };

        // Email content using EXACT SAME TEMPLATE as customer emails with REAL data
        const emailContent = {
            to: testEmails.to,
            cc: testEmails.cc.length > 0 ? testEmails.cc : undefined,
            bcc: testEmails.bcc.length > 0 ? testEmails.bcc : undefined,
            from: {
                email: 'soluship@integratedcarriers.com',
                name: 'Integrated Carriers'
            },
            subject: `Integrated Carriers - Invoice Notification`,
            html: generateInvoiceEmailHTML(firstInvoiceData, companyInfo, false, formatCurrency),
            text: generateInvoiceEmailText(firstInvoiceData, companyInfo, false, formatCurrency),
            attachments: allInvoicePDFs.map(pdf => ({
                content: pdf.content,
                filename: pdf.filename,
                type: pdf.type,
                disposition: pdf.disposition
            }))
        };

        console.log('Sending invoice email with all PDFs attached', {
            to: testEmails.to,
            cc: testEmails.cc,
            bcc: testEmails.bcc,
            from: emailContent.from.email,
            subject: emailContent.subject,
            attachments: allInvoicePDFs.length,
            invoiceMode: invoiceMode
        });

        // Send email using SendGrid (EXACT SAME AS CUSTOMER EMAILS)
        await sgMail.send(emailContent);
        
        const totalRecipients = testEmails.to.length + testEmails.cc.length + testEmails.bcc.length;
        console.log('Invoice email sent successfully to:', totalRecipients, 'recipients', {
            to: testEmails.to,
            cc: testEmails.cc,
            bcc: testEmails.bcc,
            attachments: allInvoicePDFs.length,
            invoiceMode: invoiceMode
        });
        
    } catch (error) {
        console.error('Error sending invoice email with all invoices:', error);
        throw error;
    }
} 