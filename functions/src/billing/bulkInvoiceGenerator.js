const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const archiver = require('archiver');

// Initialize Firebase Admin if not already initialized
try {
    initializeApp();
} catch (error) {
    // App already initialized
}

const db = getFirestore();

// ✅ SEQUENTIAL INVOICE NUMBERING SYSTEM
async function getNextInvoiceNumber() {
    const invoiceCounterRef = db.collection('system').doc('invoiceCounter');
    
    try {
        // Use atomic transaction to ensure unique sequential numbers
        const result = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(invoiceCounterRef);
            
            let currentNumber;
            if (!counterDoc.exists) {
                // Initialize counter starting at 1000000 (first invoice will be 1000001)
                currentNumber = 1000000;
                transaction.set(invoiceCounterRef, { 
                    currentNumber: currentNumber,
                    lastUpdated: FieldValue.serverTimestamp(),
                    createdAt: FieldValue.serverTimestamp()
                });
            } else {
                currentNumber = counterDoc.data().currentNumber || 1000000;
            }
            
            // Increment counter for next use
            const nextNumber = currentNumber + 1;
            transaction.update(invoiceCounterRef, { 
                currentNumber: nextNumber,
                lastUpdated: FieldValue.serverTimestamp()
            });
            
            return nextNumber;
        });
        
        // Format as 7-digit number (pad with leading zeros if needed)
        const formattedNumber = result.toString().padStart(7, '0');
        console.log(`Generated sequential invoice number: ${formattedNumber}`);
        
        return formattedNumber;
    } catch (error) {
        console.error('Error generating sequential invoice number:', error);
        // Fallback to timestamp-based number if sequential fails
        const fallbackNumber = (1000000 + Date.now() % 9000000).toString();
        console.warn(`Using fallback invoice number: ${fallbackNumber}`);
        return fallbackNumber;
    }
}

// ✅ HELPER FUNCTION: Get actual customer name from database lookup
async function getActualCustomerName(shipment, companyId) {
    const shipmentCustomerId = shipment.customerId || shipment.customerID || shipment.customer?.id || shipment.shipTo?.customerID;
    
    if (!shipmentCustomerId) {
        return shipment.shipTo?.companyName || shipment.shipTo?.company || 'Unknown Customer';
    }
    
    try {
        // Try direct document lookup first
        let customerDoc = await db.collection('customers').doc(shipmentCustomerId).get();
        
        if (!customerDoc.exists) {
            // Fallback: query by customerID field
            const customerQuery = db.collection('customers').where('customerID', '==', shipmentCustomerId).limit(1);
            const customerSnapshot = await customerQuery.get();
            
            if (!customerSnapshot.empty) {
                customerDoc = customerSnapshot.docs[0];
            }
        }
        
        if (customerDoc.exists) {
            const customer = customerDoc.data();
            return customer.name || customer.companyName || shipment.shipTo?.companyName || 'Unknown Customer';
        }
    } catch (error) {
        console.error(`Error looking up customer ${shipmentCustomerId}:`, error);
    }
    
    // Fallback to shipTo if customer lookup fails
    return shipment.shipTo?.companyName || shipment.shipTo?.company || 'Unknown Customer';
}

// ✅ HELPER FUNCTION: Calculate total weight from packages or shipment data
function calculateTotalWeight(shipment) {
    // First try explicit totalWeight field
    if (shipment.totalWeight && shipment.totalWeight > 0) {
        return shipment.totalWeight;
    }
    
    // Then try weight field
    if (shipment.weight && shipment.weight > 0) {
        return shipment.weight;
    }
    
    // Calculate from packages array
    if (shipment.packages && Array.isArray(shipment.packages)) {
        const calculatedWeight = shipment.packages.reduce((total, pkg) => {
            const weight = parseFloat(pkg.weight || 0);
            const quantity = parseInt(pkg.quantity || 1);
            return total + (weight * quantity);
        }, 0);
        
        if (calculatedWeight > 0) {
            return calculatedWeight;
        }
    }
    
    // Calculate from package count and average weight
    if (shipment.packageCount && shipment.averageWeight) {
        return shipment.packageCount * shipment.averageWeight;
    }
    
    // Default fallback
    return 0;
}

// AUTO INVOICE GENERATOR - Customer-Grouped ZIP Files with Comprehensive Filtering
exports.generateBulkInvoices = onRequest(
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

    let archive;
    
    try {
        console.log('Starting Auto Invoice generation...');

        const { companyId, companyName, invoiceMode = 'separate', filters = {} } = req.body;
        
        if (!companyId) {
            return res.status(400).json({ error: 'Company ID required' });
        }

        console.log(`Generating invoices for company: ${companyName || companyId}`);
        console.log(`Invoice mode: ${invoiceMode}`);
        console.log(`Applied filters:`, filters);

        // 1. BUILD DYNAMIC QUERY WITH ALL FILTERS
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
            // SPECIFIC SHIPMENT IDs MODE (with date/status filtering)
            console.log(`Filtering by ${filters.shipmentIds.length} specific shipment IDs with date/status filters`);
            
            // Firestore 'in' queries are limited to 10 items, so we need to batch
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
            const shipmentsSnapshot = await baseQuery.get();
            shipments = shipmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            console.log(`Found ${shipments.length} total shipments for ${companyId} with date/status filters`);
        }

        // 2. CUSTOMER FILTERING (if specified)
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

        // 3. VALIDATE CHARGES (existing logic)
        const validShipments = shipments.filter(shipment => {
            const charges = getSimpleShipmentCharges(shipment);
            return charges > 0;
        });

        console.log(`${validShipments.length} shipments have valid charges (${shipments.length - validShipments.length} filtered out)`);

        if (validShipments.length === 0) {
            const filterSummary = [];
            if (filters.dateFrom || filters.dateTo) {
                filterSummary.push(`date range (${filters.dateFrom || 'any'} to ${filters.dateTo || 'any'})`);
            }
            if (filters.status) {
                filterSummary.push(`status: ${filters.status}`);
            }
            if (filters.customers && filters.customers.length > 0) {
                filterSummary.push(`${filters.customers.length} customers`);
            }
            if (filters.shipmentIds && filters.shipmentIds.length > 0) {
                filterSummary.push(`${filters.shipmentIds.length} shipment IDs`);
            }
            const filterText = filterSummary.length > 0 ? ` matching filters (${filterSummary.join(', ')})` : '';
            
            return res.status(400).json({ 
                error: `No shipments with charges found for company ${companyId}${filterText}` 
            });
        }

        // 4. GROUP SHIPMENTS BY CUSTOMER (FIXED to use actual customer names)
        console.log('Looking up actual customer names for proper ZIP folder structure...');
        
        // Create customer groups with actual customer names
        const customerGroups = {};
        
        for (const shipment of validShipments) {
            // ✅ FIXED: Get actual customer name from database lookup
            const actualCustomerName = await getActualCustomerName(shipment, companyId);
            
            // Clean customer name for folder (remove special characters)
            const cleanCustomerName = actualCustomerName.replace(/[<>:"/\\|?*]/g, '-').trim();
            
            if (!customerGroups[cleanCustomerName]) {
                customerGroups[cleanCustomerName] = [];
            }
            customerGroups[cleanCustomerName].push(shipment);
        }

        console.log(`Grouped into ${Object.keys(customerGroups).length} customer folders using actual customer names`);

        // 5. SET UP ENHANCED ZIP STREAMING (with comprehensive filename)
        const timestamp = Date.now();
        let zipFilename = `${companyId}-Invoices-${timestamp}.zip`;
        
        // Add comprehensive filter details to filename
        const filenameParts = [companyId, 'Invoices'];
        if (filters.dateFrom || filters.dateTo) {
            filenameParts.push('DateFiltered');
        }
        if (filters.status) {
            filenameParts.push(filters.status);
        }
        if (filters.customers && filters.customers.length > 0) {
            filenameParts.push(`${filters.customers.length}customers`);
        }
        if (filters.shipmentIds && filters.shipmentIds.length > 0) {
            filenameParts.push(`${filters.shipmentIds.length}shipments`);
        }
        filenameParts.push(timestamp.toString());
        zipFilename = filenameParts.join('-') + '.zip';
        
        // Set headers BEFORE creating archive
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Create archive and pipe to response
        archive = archiver('zip', { 
            zlib: { level: 9 }
        });

        // Handle archive events
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Archive creation failed' });
            }
        });

        archive.on('warning', (err) => {
            console.warn('Archive warning:', err);
        });

        // Pipe archive to response
        archive.pipe(res);

        // 6. GENERATE PDFs WITH ENHANCED PROGRESS TRACKING
        const { generateInvoicePDF } = require('../generateInvoicePDFAndEmail');
        const currency = detectSimpleCurrency(validShipments);
        
        let successCount = 0;
        let errorCount = 0;
        
        console.log('Starting PDF generation...');

        // ✅ ENHANCED: Handle both separate and combined invoice modes
        console.log(`Using invoice mode: ${invoiceMode}`);

        if (invoiceMode === 'combined') {
            // COMBINED MODE: One invoice per customer with multiple line items
            const result = await generateCombinedInvoices(customerGroups, companyId, companyName, currency, archive);
            successCount += result.successCount;
            errorCount += result.errorCount;
        } else {
            // SEPARATE MODE: One invoice per shipment (existing behavior)
            const result = await generateSeparateInvoices(customerGroups, companyId, companyName, currency, archive);
            successCount += result.successCount;
            errorCount += result.errorCount;
        }

        // 7. ADD COMPREHENSIVE SUMMARY FILE
        const appliedFilters = [];
        if (filters.dateFrom || filters.dateTo) {
            appliedFilters.push(`Date Range: ${filters.dateFrom || 'any'} to ${filters.dateTo || 'any'}`);
        }
        if (filters.status) {
            appliedFilters.push(`Status Filter: ${filters.status}`);
        }
        if (filters.customers && filters.customers.length > 0) {
            appliedFilters.push(`Customer Filter: ${filters.customers.length} customers (${filters.customers.join(', ')})`);
        }
        if (filters.shipmentIds && filters.shipmentIds.length > 0) {
            appliedFilters.push(`Shipment ID Filter: ${filters.shipmentIds.length} specific shipment IDs`);
        }

        const summaryContent = `Auto Invoice Generation Summary
Generated: ${new Date().toISOString()}
Company: ${companyName || companyId} (${companyId})

Applied Filters:
${appliedFilters.length > 0 ? appliedFilters.join('\n') : 'None - All shipments processed'}

Results:
Successful PDFs: ${successCount}
Failed PDFs: ${errorCount}
Customer folders: ${Object.keys(customerGroups).length}
Total shipments processed: ${validShipments.length}

Customer Breakdown:
${Object.entries(customerGroups).map(([customer, shipments]) => 
    `- ${customer}: ${shipments.length} shipments`
).join('\n')}

Filter Details:
- Original query returned: ${shipments.length} shipments
- After charge validation: ${validShipments.length} shipments
- Date range: ${filters.dateFrom || 'any'} to ${filters.dateTo || 'any'}
- Status filter: ${filters.status || 'all'}
- ZIP filename: ${zipFilename}`;

        archive.append(Buffer.from(summaryContent), { name: 'GENERATION-SUMMARY.txt' });

        console.log(`ZIP Creation Summary:`);
        console.log(`   Successful PDFs: ${successCount}`);
        console.log(`   Failed PDFs: ${errorCount}`);
        console.log(`   Customer folders: ${Object.keys(customerGroups).length}`);
        console.log(`   Applied filters: ${appliedFilters.length > 0 ? appliedFilters.join(', ') : 'None'}`);

        // 8. FINALIZE ARCHIVE
        console.log('Finalizing ZIP archive...');
        await archive.finalize();
        
        console.log('Auto Invoice generation completed successfully');

    } catch (error) {
        console.error('Auto Invoice generation error:', error);
        
        // If archive exists and hasn't been finalized, abort it
        if (archive) {
            try {
                archive.abort();
            } catch (abortError) {
                console.error('Error aborting archive:', abortError);
            }
        }
        
        // Only send JSON error if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// ✅ SEPARATE INVOICE MODE: One invoice per shipment (existing behavior)
async function generateSeparateInvoices(customerGroups, companyId, companyName, currency, archive) {
    const { generateInvoicePDF } = require('../generateInvoicePDFAndEmail');
    
    let successCount = 0;
    let errorCount = 0;

    // Fetch customer company data for proper billing information (BILL TO)
    for (const [customerName, customerShipments] of Object.entries(customerGroups)) {
        console.log(`Processing ${customerShipments.length} shipments for ${customerName}...`);
        
        for (const shipment of customerShipments) {
            try {
                const charges = getSimpleShipmentCharges(shipment);
                const shipmentId = shipment.shipmentID || shipment.id;
                
                console.log(`Generating PDF for shipment ${shipmentId} (${charges} ${currency})...`);

                // Get customer billing information
                const companyInfo = await getCustomerBillingInfo(shipment, companyId);

                // ✅ UPDATED: Use sequential invoice numbering
                const sequentialInvoiceNumber = await getNextInvoiceNumber();

                // Create invoice data for this single shipment
                const invoiceData = {
                    invoiceNumber: sequentialInvoiceNumber, // ✅ CHANGED: From `INV-${shipmentId}` to sequential number
                    companyId: companyId,
                    companyName: companyInfo.companyName || customerName || companyName || companyId,
                    
                    // Single line item for this shipment
                    lineItems: [{
                        shipmentId: shipmentId,
                        orderNumber: shipmentId,
                        trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
                        description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
                        carrier: shipment.carrier || shipment.selectedCarrier?.name || 'N/A',
                        service: shipment.service || 'Standard',
                        date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
                        charges: charges,
                        chargeBreakdown: getSimpleChargeBreakdown(shipment, charges, currency),
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
                    
                    // Totals for this single shipment
                    subtotal: charges,
                    tax: 0,
                    total: charges
                };

                const pdfBuffer = await generateInvoicePDF(invoiceData, companyInfo);

                // Validate PDF buffer
                if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
                    throw new Error(`Invalid PDF buffer generated`);
                }

                console.log(`Generated PDF for ${shipmentId} - Size: ${pdfBuffer.length} bytes`);

                // Add PDF to archive in customer folder
                const filename = `${customerName}/Invoice-${sequentialInvoiceNumber}.pdf`; // ✅ CHANGED: From shipmentId to sequentialInvoiceNumber
                archive.append(pdfBuffer, { name: filename });
                
                successCount++;

            } catch (pdfError) {
                console.error(`Error generating PDF for shipment ${shipment.shipmentID || shipment.id}:`, pdfError);
                errorCount++;
                
                // Add error log to archive instead of failing completely
                const errorFilename = `${customerName}/ERROR-${shipment.shipmentID || shipment.id}.txt`;
                const errorContent = `Failed to generate invoice for shipment ${shipment.shipmentID || shipment.id}
Error: ${pdfError.message}
Stack: ${pdfError.stack}
Timestamp: ${new Date().toISOString()}

Shipment Data Summary:
- Creation Method: ${shipment.creationMethod || 'unknown'}
- Company ID: ${shipment.companyID || 'unknown'}
- Customer ID: ${shipment.shipTo?.customerID || 'unknown'}
- Charges: ${getSimpleShipmentCharges(shipment)}
- Currency: ${currency}
- Status: ${shipment.status || 'unknown'}
- Date: ${shipment.createdAt || 'unknown'}`;
                
                archive.append(Buffer.from(errorContent), { name: errorFilename });
            }
        }
    }
    return { successCount, errorCount };
}

// ✅ COMBINED INVOICE MODE: One invoice per customer with multiple line items
async function generateCombinedInvoices(customerGroups, companyId, companyName, currency, archive) {
    const { generateInvoicePDF } = require('../generateInvoicePDFAndEmail');
    
    let successCount = 0;
    let errorCount = 0;

    for (const [customerName, customerShipments] of Object.entries(customerGroups)) {
        console.log(`Generating COMBINED invoice for ${customerName} with ${customerShipments.length} shipments...`);
        
        try {
            // Calculate totals for all shipments for this customer
            let totalCharges = 0;
            const lineItems = [];
            let companyInfo = null;

            // Process all shipments for this customer
            for (const shipment of customerShipments) {
                const charges = getSimpleShipmentCharges(shipment);
                const shipmentId = shipment.shipmentID || shipment.id;
                
                console.log(`Adding shipment ${shipmentId} (${charges} ${currency}) to combined invoice...`);
                
                // Get customer billing info from first shipment (same for all shipments from same customer)
                if (!companyInfo) {
                    companyInfo = await getCustomerBillingInfo(shipment, companyId);
                }

                // Add this shipment as a line item
                lineItems.push({
                    shipmentId: shipmentId,
                    orderNumber: shipmentId,
                    trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
                    description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
                    carrier: shipment.carrier || shipment.selectedCarrier?.name || 'N/A',
                    service: shipment.service || 'Standard',
                    date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
                    charges: charges,
                    chargeBreakdown: getSimpleChargeBreakdown(shipment, charges, currency),
                    packages: shipment.packages?.length || shipment.packageCount || 1,
                    weight: calculateTotalWeight(shipment),
                    weightUnit: shipment.weightUnit || 'lbs',
                    shipFrom: shipment.shipFrom,
                    shipTo: shipment.shipTo
                });

                totalCharges += charges;
            }

            // ✅ UPDATED: Use sequential invoice numbering for combined invoices
            const sequentialInvoiceNumber = await getNextInvoiceNumber();

            // Create combined invoice data
            const invoiceData = {
                invoiceNumber: sequentialInvoiceNumber, // ✅ CHANGED: From complex naming to sequential number
                companyId: companyId,
                companyName: companyInfo?.companyName || customerName || companyName || companyId,
                
                // ✅ MULTIPLE LINE ITEMS: All shipments for this customer
                lineItems: lineItems,
                
                currency: currency,
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                paymentTerms: 'NET 30',
                
                // ✅ COMBINED TOTALS: Sum of all shipments
                subtotal: totalCharges,
                tax: 0,
                total: totalCharges
            };

            console.log(`Generated combined invoice ${sequentialInvoiceNumber} for ${customerName}: $${totalCharges} ${currency} (${lineItems.length} shipments)`);

            const pdfBuffer = await generateInvoicePDF(invoiceData, companyInfo || {});

            // Validate PDF buffer
            if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
                throw new Error(`Invalid PDF buffer generated for combined invoice`);
            }

            console.log(`Generated combined PDF for ${customerName} - Size: ${pdfBuffer.length} bytes`);

            // Add combined PDF to archive in customer folder
            const filename = `${customerName}/Combined-Invoice-${sequentialInvoiceNumber}.pdf`;
            archive.append(pdfBuffer, { name: filename });
            
            successCount++;

        } catch (pdfError) {
            console.error(`Error generating combined PDF for ${customerName}:`, pdfError);
            errorCount++;
            
            // Add error log to archive
            const errorFilename = `${customerName}/ERROR-Combined-Invoice.txt`;
            const errorContent = `Failed to generate combined invoice for ${customerName}
Error: ${pdfError.message}
Stack: ${pdfError.stack}
Timestamp: ${new Date().toISOString()}

Customer: ${customerName}
Shipments: ${customerShipments.length}
Total Expected Charges: ${customerShipments.reduce((sum, s) => sum + getSimpleShipmentCharges(s), 0)} ${currency}`;
            
            archive.append(Buffer.from(errorContent), { name: errorFilename });
        }
    }
    return { successCount, errorCount };
}

// ✅ HELPER: Get customer billing information (extracted from existing logic)
async function getCustomerBillingInfo(shipment, companyId) {
    const shipmentCustomerId = shipment.customerId || shipment.customerID || shipment.customer?.id || shipment.shipTo?.customerID;
    
    if (!shipmentCustomerId) {
        console.log(`No customer ID found for shipment ${shipment.shipmentID || shipment.id}, BILL TO will be blank`);
        return {
            companyName: '',
            companyId: companyId,
            name: '',
            address: {},
            billingAddress: {},
            phone: '',
            email: '',
            billingPhone: '',
            billingEmail: ''
        };
    }

    try {
        // Try direct document lookup first
        let customerDoc = await db.collection('customers').doc(shipmentCustomerId).get();
        
        if (!customerDoc.exists) {
            // Fallback: query by customerID field
            const customerQuery = db.collection('customers').where('customerID', '==', shipmentCustomerId).limit(1);
            const customerSnapshot = await customerQuery.get();
            
            if (!customerSnapshot.empty) {
                customerDoc = customerSnapshot.docs[0];
            }
        }

        if (customerDoc.exists) {
            const customer = customerDoc.data();
            
            // Check if customer belongs to this company
            if (customer.companyID === companyId) {
                // Check if customer has billing address info, otherwise use main contact address
                if (customer.billingAddress1 && customer.billingCity) {
                    // Use customer's billing address
                    return {
                        companyName: customer.name,
                        companyId: customer.companyID,
                        name: customer.name,
                        address: {
                            street: customer.billingAddress1,
                            addressLine2: customer.billingAddress2,
                            city: customer.billingCity,
                            state: customer.billingState,
                            postalCode: customer.billingPostalCode,
                            country: customer.billingCountry
                        },
                        billingAddress: {
                            street: customer.billingAddress1,
                            addressLine2: customer.billingAddress2,
                            city: customer.billingCity,
                            state: customer.billingState,
                            postalCode: customer.billingPostalCode,
                            country: customer.billingCountry
                        },
                        phone: customer.billingPhone || customer.mainContactPhone,
                        email: customer.billingEmail,
                        billingPhone: customer.billingPhone || customer.mainContactPhone,
                        billingEmail: customer.billingEmail
                    };
                } else if (customer.mainContactAddress1 && customer.mainContactCity) {
                    // Fallback to main contact address
                    return {
                        companyName: customer.name,
                        companyId: customer.companyID,
                        name: customer.name,
                        address: {
                            street: customer.mainContactAddress1,
                            addressLine2: customer.mainContactAddress2,
                            city: customer.mainContactCity,
                            state: customer.mainContactState,
                            postalCode: customer.mainContactPostalCode,
                            country: customer.mainContactCountry
                        },
                        billingAddress: {
                            street: customer.mainContactAddress1,
                            addressLine2: customer.mainContactAddress2,
                            city: customer.mainContactCity,
                            state: customer.mainContactState,
                            postalCode: customer.mainContactPostalCode,
                            country: customer.mainContactCountry
                        },
                        phone: customer.mainContactPhone,
                        email: customer.mainContactEmail || customer.billingEmail,
                        billingPhone: customer.mainContactPhone,
                        billingEmail: customer.billingEmail || customer.mainContactEmail
                    };
                } else {
                    // Final fallback - customer with no address info
                    return {
                        companyName: customer.name,
                        companyId: customer.companyID,
                        name: customer.name,
                        address: {},
                        billingAddress: {},
                        phone: customer.mainContactPhone || customer.billingPhone,
                        email: customer.mainContactEmail || customer.billingEmail,
                        billingPhone: customer.mainContactPhone || customer.billingPhone,
                        billingEmail: customer.billingEmail || customer.mainContactEmail
                    };
                }
            }
        }
    } catch (error) {
        console.error(`Error looking up customer billing info:`, error);
    }

    // Final fallback
    return {
        companyName: '',
        companyId: companyId,
        name: '',
        address: {},
        billingAddress: {},
        phone: '',
        email: '',
        billingPhone: '',
        billingEmail: ''
    };
}

function getSimpleShipmentCharges(shipment) {
    try {
        // QuickShip: Sum manual rates
        if (shipment.creationMethod === 'quickship' && shipment.manualRates?.length) {
            const total = shipment.manualRates.reduce((sum, rate) => {
                const charge = parseFloat(rate.charge) || parseFloat(rate.cost) || 0;
                return sum + charge;
            }, 0);
            if (total > 0) return total;
        }
        
        // Regular shipments: Use markup rates first
        if (shipment.markupRates?.totalCharges && shipment.markupRates.totalCharges > 0) {
            return shipment.markupRates.totalCharges;
        }
        
        // Try selected rate
        if (shipment.selectedRate?.totalCharges && shipment.selectedRate.totalCharges > 0) {
            return shipment.selectedRate.totalCharges;
        }
        
        // Try direct total charges
        if (shipment.totalCharges && shipment.totalCharges > 0) {
            return shipment.totalCharges;
        }
        
        // Try charges field
        if (shipment.charges && shipment.charges > 0) {
            return shipment.charges;
        }
        
        return 0;
    } catch (error) {
        console.warn(`Error calculating charges for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return 0;
    }
}

function getSimpleChargeBreakdown(shipment, totalCharges, currency) {
    try {
        // Try to get breakdown from manual rates
        if (shipment.creationMethod === 'quickship' && shipment.manualRates?.length) {
            return shipment.manualRates.map(rate => ({
                description: rate.chargeName || rate.description || 'Freight',
                amount: parseFloat(rate.charge) || parseFloat(rate.cost) || 0
            }));
        }
        
        // Default: Single freight charge
        return [{
            description: 'Freight',
            amount: totalCharges
        }];
    } catch (error) {
        console.warn(`Error getting charge breakdown for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return [{
            description: 'Freight',
            amount: totalCharges
        }];
    }
}

function detectSimpleCurrency(shipments) {
    try {
        // Look for currency in shipment data
        for (const shipment of shipments) {
            if (shipment.currency) return shipment.currency;
            if (shipment.selectedRate?.currency) return shipment.selectedRate.currency;
            if (shipment.markupRates?.currency) return shipment.markupRates.currency;
            if (shipment.manualRates?.length && shipment.manualRates[0].currency) {
                return shipment.manualRates[0].currency;
            }
        }
    } catch (error) {
        console.warn('Error detecting currency:', error);
    }
    
    return 'CAD'; // Default to CAD for most companies
} 