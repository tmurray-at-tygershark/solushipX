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

// ✅ HELPER FUNCTION: Get actual customer name from database lookup (FIXED: Use comprehensive customer ID extraction)
async function getActualCustomerName(shipment, companyId) {
    // Use the same comprehensive customer ID extraction as filtering logic
    const candidates = [
        shipment?.shipTo?.customerID,
        shipment?.customerID,
        shipment?.shipFrom?.customerID,
        // Legacy variants
        shipment?.shipTo?.customerId,
        shipment?.shipFrom?.customerId,
        shipment?.shipTo?._rawData?.customerID,
        shipment?.shipFrom?._rawData?.customerID,
        shipment?.customerId,
        shipment?.customer?.id
    ];
    // Get the first non-null candidate (preserve original case for database lookup)
    const shipmentCustomerId = candidates.find(id => id && String(id).trim()) || null;
    
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

// Normalize a string customer ID for safe comparison
function normalizeCustomerId(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.toUpperCase();
}

// Collect ALL possible customer ID candidates from a shipment (legacy + current)
function getAllCustomerIdCandidates(shipment) {
    const candidates = [];
    try {
        // Primary modern fields
        candidates.push(
            shipment?.shipTo?.customerID,
            shipment?.customerID,
            shipment?.shipFrom?.customerID
        );

        // Legacy variations (camelCase Id and nested _rawData)
        candidates.push(
            shipment?.shipTo?.customerId,
            shipment?.shipFrom?.customerId,
            shipment?.shipTo?._rawData?.customerID,
            shipment?.shipFrom?._rawData?.customerID
        );

        // Other occasional locations
        candidates.push(
            shipment?.customerId,
            shipment?.customer?.id
        );
    } catch (e) {
        console.warn('getAllCustomerIdCandidates error:', e);
    }

    // Normalize and de-duplicate
    const normalized = candidates
        .map(normalizeCustomerId)
        .filter(Boolean);
    return Array.from(new Set(normalized));
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

                    const { companyId, companyName, invoiceMode = 'separate', invoiceIssueDate = null, filters = {} } = req.body;
        
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
        const filteringDetails = {
            requestedShipmentIds: filters.shipmentIds || [],
            foundShipmentIds: [],
            filteredOut: [],
            customerFiltered: [],
            chargeFiltered: []
        };

        if (filters.shipmentIds && filters.shipmentIds.length > 0) {
            // SPECIFIC SHIPMENT IDs MODE (with date/status filtering)
            console.log(`Filtering by ${filters.shipmentIds.length} specific shipment IDs with date/status filters`);
            
            // First, check which shipments exist at all (without additional filters)
            const allBatches = [];
            for (let i = 0; i < filters.shipmentIds.length; i += 10) {
                const batch = filters.shipmentIds.slice(i, i + 10);
                allBatches.push(batch);
            }

            // Check existence without filters to identify missing shipments
            const existencePromises = allBatches.map(batch => 
                db.collection('shipments')
                    .where('companyID', '==', companyId)
                    .where('shipmentID', 'in', batch)
                    .get()
            );

            const existenceResults = await Promise.all(existencePromises);
            const foundShipmentIds = [];
            existenceResults.forEach(snapshot => {
                snapshot.docs.forEach(doc => {
                    foundShipmentIds.push(doc.data().shipmentID);
                });
            });

            filteringDetails.foundShipmentIds = foundShipmentIds;
            
            // Identify missing shipments
            const missingShipmentIds = filters.shipmentIds.filter(id => !foundShipmentIds.includes(id));
            missingShipmentIds.forEach(id => {
                filteringDetails.filteredOut.push({
                    shipmentId: id,
                    reason: 'Shipment not found in database or wrong company'
                });
            });

            // Now apply filters to found shipments
            const batchPromises = allBatches.map(batch => {
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

            // Identify shipments filtered out by date/status
            const afterFilterShipmentIds = shipments.map(s => s.shipmentID);
            const dateStatusFiltered = foundShipmentIds.filter(id => !afterFilterShipmentIds.includes(id));
            dateStatusFiltered.forEach(id => {
                let reason = 'Filtered by: ';
                const reasons = [];
                if (filters.dateFrom || filters.dateTo) reasons.push('date range');
                if (filters.status) reasons.push(`status (not ${filters.status})`);
                if (reasons.length === 0) reasons.push('draft status');
                filteringDetails.filteredOut.push({
                    shipmentId: id,
                    reason: reason + reasons.join(', ')
                });
            });

            console.log(`Found ${shipments.length} shipments matching specific IDs with additional filters`);

        } else {
            // ALL SHIPMENTS MODE (with date/status filtering)
            const shipmentsSnapshot = await baseQuery.get();
            shipments = shipmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            console.log(`Found ${shipments.length} total shipments for ${companyId} with date/status filters`);
        }

        // 2. CUSTOMER FILTERING (EXACT SAME AS TEST EMAIL - WORKING VERSION)
        if (filters.customers && filters.customers.length > 0) {
            console.log(`Filtering by ${filters.customers.length} specific customers`);
            
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

            shipments = shipments.filter(shipment => {
                const candidates = getCandidates(shipment);
                const matches = candidates.some(cid => targets.includes(cid));

                if (!matches) {
                    filteringDetails.customerFiltered.push({
                        shipmentId: shipment.shipmentID,
                        reason: `Customer mismatch - found: ${candidates.join('/') || 'unknown'}, required: ${targets.join(', ')}`
                    });
                }

                return matches;
            });

            console.log(`Customer filter reduced shipments from ${originalCount} to ${shipments.length}`);
        }

        // 3. VALIDATE CHARGES (existing logic)
        const beforeChargeValidation = [...shipments];
        const validShipments = shipments.filter(shipment => {
            const charges = getSimpleShipmentCharges(shipment);
            const hasValidCharges = charges > 0;
            
            if (!hasValidCharges) {
                filteringDetails.chargeFiltered.push({
                    shipmentId: shipment.shipmentID,
                    reason: `No valid charges found (charges: $${charges})`
                });
            }
            
            return hasValidCharges;
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
                            const result = await generateCombinedInvoices(customerGroups, companyId, companyName, currency, archive, invoiceIssueDate);
            successCount += result.successCount;
            errorCount += result.errorCount;
        } else {
            // SEPARATE MODE: One invoice per shipment (existing behavior)
                            const result = await generateSeparateInvoices(customerGroups, companyId, companyName, currency, archive, invoiceIssueDate);
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

        // Create detailed filtering breakdown
        const allFilteredOut = [
            ...filteringDetails.filteredOut,
            ...filteringDetails.customerFiltered,
            ...filteringDetails.chargeFiltered
        ];

        const filteringBreakdown = allFilteredOut.length > 0 ? 
            `\nFiltered Out Shipments (${allFilteredOut.length} total):
${allFilteredOut.map(item => `- ${item.shipmentId}: ${item.reason}`).join('\n')}` : 
            '\nFiltered Out Shipments: None';

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
- Requested shipment IDs: ${filteringDetails.requestedShipmentIds.length}
- Found in database: ${filteringDetails.foundShipmentIds.length}
- After date/status filters: ${shipments.length} shipments
- After customer filter: ${shipments.length} shipments
- After charge validation: ${validShipments.length} shipments
- Date range: ${filters.dateFrom || 'any'} to ${filters.dateTo || 'any'}
- Status filter: ${filters.status || 'all'}
- ZIP filename: ${zipFilename}${filteringBreakdown}`;

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
async function generateSeparateInvoices(customerGroups, companyId, companyName, currency, archive, invoiceIssueDate = null) {
    const { generateInvoicePDF } = require('../generateInvoicePDFAndEmail');
    
    let successCount = 0;
    let errorCount = 0;

    // Load company data once for all invoices (for logo, AR contact, etc.)
    const invoiceCompanyInfo = await getInvoiceCompanyInfo(companyId);

    // Fetch customer company data for proper billing information (BILL TO)
    for (const [customerName, customerShipments] of Object.entries(customerGroups)) {
        console.log(`Processing ${customerShipments.length} shipments for ${customerName}...`);
        
        for (const shipment of customerShipments) {
            try {
                const charges = getSimpleShipmentCharges(shipment);
                const shipmentId = shipment.shipmentID || shipment.id;
                
                console.log(`Generating PDF for shipment ${shipmentId} (${charges} ${currency})...`);

                // Get customer billing information (for BILL TO section)
                const customerBillingInfo = await getCustomerBillingInfo(shipment, companyId);

                // ✅ UPDATED: Use sequential invoice numbering
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
                    companyName: customerBillingInfo.companyName || customerName || companyName || companyId,
                    
                    // Single line item for this shipment
                    lineItems: [{
                        shipmentId: shipmentId,
                        orderNumber: shipmentId,
                        trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
                        description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
                        carrier: invoiceCompanyInfo?.billingInfo?.companyDisplayName || invoiceCompanyInfo?.name || 'Integrated Carriers', // Use dynamic company name for customer invoices
                        service: shipment.service || 'Standard',
                        date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
                        charges: filteredCharges, // Use filtered amount (excludes transaction fees)
                        chargeBreakdown: chargeBreakdown,
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
                    
                    // ✅ UPDATED: Proper tax separation using the new calculation system with Quebec breakdown
                    subtotal: invoiceTotals.subtotal,  // Total of non-tax items
                    tax: invoiceTotals.tax,           // Total of tax items
                    total: invoiceTotals.total,       // Subtotal + tax
                    // 🍁 NEW: Quebec tax breakdown support
                    taxBreakdown: invoiceTotals.taxBreakdown,
                    hasQuebecTaxes: invoiceTotals.hasQuebecTaxes
                };

                const pdfBuffer = await generateInvoicePDF(invoiceData, invoiceCompanyInfo, customerBillingInfo);

                // Validate PDF buffer
                if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
                    throw new Error(`Invalid PDF buffer generated`);
                }

                console.log(`Generated PDF for ${shipmentId} - Size: ${pdfBuffer.length} bytes`);

                // 🔥 NEW: Save PDF to Firebase Storage (same as individual invoice system)
                const { getStorage } = require('firebase-admin/storage');
                const storage = getStorage();
                const storageFileName = `invoices/${sequentialInvoiceNumber}.pdf`;
                const file = storage.bucket().file(storageFileName);
                
                try {
                    await file.save(pdfBuffer, {
                        metadata: {
                            contentType: 'application/pdf',
                            metadata: {
                                invoiceNumber: sequentialInvoiceNumber,
                                companyId: companyId,
                                generatedAt: new Date().toISOString(),
                                generatedVia: 'bulk_zip_generator',
                                customerName: customerName,
                                shipmentId: shipmentId
                            }
                        }
                    });
                    
                    console.log(`✅ Invoice PDF saved to storage: ${storageFileName}`);
                } catch (storageError) {
                    console.error(`❌ Failed to save invoice ${sequentialInvoiceNumber} to storage:`, storageError);
                    // Don't fail the whole process if storage fails, just log it
                }

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
async function generateCombinedInvoices(customerGroups, companyId, companyName, currency, archive, invoiceIssueDate = null) {
    const { generateInvoicePDF } = require('../generateInvoicePDFAndEmail');
    
    let successCount = 0;
    let errorCount = 0;

    // Load company data once for all invoices (for logo, AR contact, etc.)
    const invoiceCompanyInfo = await getInvoiceCompanyInfo(companyId);

    for (const [customerName, customerShipments] of Object.entries(customerGroups)) {
        console.log(`Generating COMBINED invoice for ${customerName} with ${customerShipments.length} shipments...`);
        
        try {
            // Calculate totals for all shipments for this customer
            let totalCharges = 0;
            const lineItems = [];
            const allChargeBreakdowns = [];
            let customerBillingInfo = null;

            // Process all shipments for this customer
            for (const shipment of customerShipments) {
                const charges = getSimpleShipmentCharges(shipment);
                const shipmentId = shipment.shipmentID || shipment.id;
                
                // Get customer billing info from first shipment (same for all shipments from same customer)
                if (!customerBillingInfo) {
                    customerBillingInfo = await getCustomerBillingInfo(shipment, companyId);
                }

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
                    carrier: invoiceCompanyInfo?.billingInfo?.companyDisplayName || invoiceCompanyInfo?.name || 'Integrated Carriers', // Use dynamic company name for customer invoices
                    service: shipment.service || 'Standard',
                    date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
                    charges: filteredCharges, // Use filtered amount (excludes transaction fees)
                    chargeBreakdown: chargeBreakdown,
                    packages: shipment.packages?.length || shipment.packageCount || 1,
                    weight: calculateTotalWeight(shipment),
                    weightUnit: shipment.weightUnit || 'lbs',
                    shipFrom: shipment.shipFrom,
                    shipTo: shipment.shipTo,
                    // 🔍 NEW: All reference numbers for comprehensive invoice display
                    allReferenceNumbers: getAllReferenceNumbers(shipment)
                });

                totalCharges += filteredCharges; // Use filtered amount (excludes transaction fees)
            }

            // ✅ UPDATED: Use sequential invoice numbering for combined invoices
            const sequentialInvoiceNumber = await getNextInvoiceNumber();

            // ✅ UPDATED: Calculate proper tax separation across all shipments
            const combinedInvoiceTotals = calculateInvoiceTotals(allChargeBreakdowns);

            // Create combined invoice data
            const invoiceData = {
                invoiceNumber: sequentialInvoiceNumber, // ✅ CHANGED: From complex naming to sequential number
                companyId: companyId,
                companyName: customerBillingInfo?.companyName || customerName || companyName || companyId,
                
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

            const pdfBuffer = await generateInvoicePDF(invoiceData, invoiceCompanyInfo, customerBillingInfo);

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

// ✅ HELPER: Get company billing information for invoice generation (logo, AR contact, etc.)
async function getInvoiceCompanyInfo(companyId) {
    try {
        console.log(`Loading company info for invoice generation: ${companyId}`);
        
        const companyQuery = db.collection('companies').where('companyID', '==', companyId).limit(1);
        const companySnapshot = await companyQuery.get();
        
        if (!companySnapshot.empty) {
            const companyData = companySnapshot.docs[0].data();
            console.log(`Loaded company data for invoices: ${companyData.name || companyId}`);
            
            return {
                companyID: companyId,
                name: companyData.name || companyId,
                website: companyData.website || '',
                logos: companyData.logos || {},
                billingInfo: companyData.billingInfo || {},
                mainContact: companyData.mainContact || {},
                ...companyData
            };
        } else {
            console.warn(`Company not found: ${companyId}, using fallback data`);
            return {
                companyID: companyId,
                name: companyId,
                website: '',
                logos: {},
                billingInfo: {},
                mainContact: {}
            };
        }
    } catch (error) {
        console.error('Error loading company info for invoice:', error);
        return {
            companyID: companyId,
            name: companyId,
            website: '',
            logos: {},
            billingInfo: {},
            mainContact: {}
        };
    }
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
        const shipmentId = shipment.shipmentID || shipment.id;
        console.log(`💰 Processing charges for shipment ${shipmentId} (${shipment.creationMethod || 'standard'})`);
        
        let rawBreakdown = [];
        
        // Try to get breakdown from manual rates
        if (shipment.creationMethod === 'quickship' && shipment.manualRates?.length) {
            console.log(`   ✅ Using manualRates (${shipment.manualRates.length} items)`);
            rawBreakdown = shipment.manualRates.map(rate => {
                const amount = parseFloat(rate.charge) || parseFloat(rate.cost) || 0;
                const code = rate.code || rate.chargeCode || 'FRT';
                const isTax = rate.isTax || isTaxCharge(code);
                
                return {
                    description: rate.chargeName || rate.description || 'Freight',
                    amount: amount,
                    code: code,
                    isTax: isTax
                };
            });
        }
        // Try to get breakdown from carrier confirmation rates
        else if (shipment.carrierConfirmationRates?.length) {
            console.log(`   ✅ Using carrierConfirmationRates (${shipment.carrierConfirmationRates.length} items)`);
            rawBreakdown = shipment.carrierConfirmationRates.map(rate => {
                const amount = parseFloat(rate.charge) || parseFloat(rate.actualCharge) || 0;
                const code = rate.code || rate.chargeCode || 'FRT';
                const isTax = rate.isTax || isTaxCharge(code);
                
                return {
                    description: rate.chargeName || rate.description || 'Freight',
                    amount: amount,
                    code: code,
                    isTax: isTax
                };
            });
        }
        // Try to get breakdown from markup rates
        else if (shipment.markupRates?.breakdown?.length) {
            console.log(`   ✅ Using markupRates.breakdown (${shipment.markupRates.breakdown.length} items)`);
            rawBreakdown = shipment.markupRates.breakdown.map(rate => {
                const amount = parseFloat(rate.charge) || parseFloat(rate.actualCharge) || 0;
                const code = rate.code || rate.chargeCode || 'FRT';
                const isTax = rate.isTax || isTaxCharge(code);
                
                return {
                    description: rate.chargeName || rate.description || 'Freight',
                    amount: amount,
                    code: code,
                    isTax: isTax
                };
            });
        }
        // Try to get breakdown from charges array (another common location)
        else if (shipment.charges?.length) {
            console.log(`   ✅ Using charges array (${shipment.charges.length} items)`);
            rawBreakdown = shipment.charges.map(charge => {
                const amount = parseFloat(charge.amount) || parseFloat(charge.charge) || 0;
                const code = charge.code || charge.chargeCode || 'FRT';
                const isTax = charge.isTax || isTaxCharge(code);
                
                return {
                    description: charge.description || charge.chargeName || 'Freight',
                    amount: amount,
                    code: code,
                    isTax: isTax
                };
            });
        }
        // Default: Single freight charge
        else {
            console.log(`   ⚠️ No detailed breakdown found, using single freight charge: $${totalCharges}`);
            rawBreakdown = [{
                description: 'Freight',
                amount: totalCharges,
                code: 'FRT',
                isTax: false
            }];
        }
        
        // ✅ FILTER OUT $0.00 LINE ITEMS AND TRANSACTION FEES
        const filteredBreakdown = rawBreakdown.filter(item => {
            const amount = parseFloat(item.amount) || 0;
            const description = (item.description || '').toLowerCase().trim();
            
            // Skip zero amount items
            if (amount <= 0) return false;
            
            // Skip transaction fees
            if (description.includes('transaction fee')) return false;
            
            return true;
        });
        
        const filteredCount = rawBreakdown.length - filteredBreakdown.length;
        if (filteredCount > 0) {
            const zeroItems = rawBreakdown.filter(item => (parseFloat(item.amount) || 0) <= 0).length;
            const transactionFees = rawBreakdown.filter(item => {
                const description = (item.description || '').toLowerCase().trim();
                return description.includes('transaction fee');
            }).length;
            
            console.log(`   🚫 Filtered out ${filteredCount} items: ${zeroItems} $0.00 charges, ${transactionFees} transaction fees`);
        }
        
        // Count tax vs non-tax items
        const taxItems = filteredBreakdown.filter(item => item.isTax);
        const regularItems = filteredBreakdown.filter(item => !item.isTax);
        
        console.log(`   📊 Final breakdown: ${filteredBreakdown.length} items (${regularItems.length} regular + ${taxItems.length} tax)`);
        
        // If all items were filtered out, return single freight charge
        if (filteredBreakdown.length === 0 && totalCharges > 0) {
            console.log(`   ⚠️ All items filtered out, returning single freight charge: $${totalCharges}`);
            return [{
                description: 'Freight',
                amount: totalCharges,
                code: 'FRT',
                isTax: false
            }];
        }
        
        return filteredBreakdown;
        
    } catch (error) {
        console.warn(`Error getting charge breakdown for shipment ${shipment.shipmentID || shipment.id}:`, error);
        return [{
            description: 'Freight',
            amount: totalCharges,
            code: 'FRT',
            isTax: false
        }];
    }
}

// Helper function to check if a charge code represents a tax
function isTaxCharge(code) {
    if (!code) return false;
    
    const upperCode = code.toUpperCase().trim();
    
    const taxCodes = [
        // Canadian Federal Taxes
        'HST', 'GST', 'QST', 'QGST',
        
            // Provincial HST variations
    'HST ON', 'HST BC', 'HST NB', 'HST NS', 'HST NL', 'HST PE',
    'HST_ON', 'HST_BC', 'HST_NB', 'HST_NS', 'HST_NL', 'HST_PE',
    'HST ONTARIO', 'HST ONTARIO', 'HST QUEBEC', 'HST ALBERTA',
        
        // Provincial PST variations (PST BC removed - freight services PST exempt)
        'PST SK', 'PST MB', 'PST QC',
        'PST_SK', 'PST_MB', 'PST_QC',
        
        // Generic tax terms
        'TAX', 'TAXES', 'SALES TAX', 'SALESTAX',
        
        // US Tax variations (if applicable)
        'SALES_TAX', 'STATE_TAX', 'LOCAL_TAX'
    ];
    
    // Direct match
    if (taxCodes.includes(upperCode)) {
        return true;
    }
    
    // Partial match for tax-related terms
    const taxPatterns = [
        /^HST/i,         // Starts with HST
        /^GST/i,         // Starts with GST  
        /^QST/i,         // Starts with QST
        /^PST/i,         // Starts with PST
        /TAX$/i,         // Ends with TAX
        /TAXES$/i,       // Ends with TAXES
        /HST.*ONTARIO/i, // HST Ontario (any variation)
        /HST.*QUEBEC/i,  // HST Quebec
        /HST.*BC/i,      // HST BC
        /HST.*ALBERTA/i  // HST Alberta
    ];
    
    for (const pattern of taxPatterns) {
        if (pattern.test(upperCode)) {
            return true;
        }
    }
    
    return false;
}

// Helper function to collect ALL reference numbers from a shipment
function getAllReferenceNumbers(shipment) {
    const allReferences = [];
    
    // Primary reference number sources
    const primarySources = [
        shipment?.shipmentInfo?.shipperReferenceNumber,
        shipment?.referenceNumber,
        shipment?.shipperReferenceNumber,
        shipment?.selectedRate?.referenceNumber,
        shipment?.selectedRateRef?.referenceNumber,
        shipment?.shipmentInfo?.bookingReferenceNumber,
        shipment?.bookingReferenceNumber
    ];

    // Add all non-empty primary references
    primarySources.forEach(ref => {
        if (ref && typeof ref === 'string' && ref.trim() && !allReferences.includes(ref.trim())) {
            allReferences.push(ref.trim());
        }
    });

    // Reference numbers from shipmentInfo.referenceNumbers array
    if (shipment?.shipmentInfo?.referenceNumbers && Array.isArray(shipment.shipmentInfo.referenceNumbers)) {
        shipment.shipmentInfo.referenceNumbers.forEach(ref => {
            let refValue = null;
            if (typeof ref === 'string') {
                refValue = ref.trim();
            } else if (ref && typeof ref === 'object') {
                refValue = (ref.number || ref.referenceNumber || ref.value)?.trim();
            }
            if (refValue && !allReferences.includes(refValue)) {
                allReferences.push(refValue);
            }
        });
    }

    // Legacy reference numbers array
    if (shipment?.referenceNumbers && Array.isArray(shipment.referenceNumbers)) {
        shipment.referenceNumbers.forEach(ref => {
            let refValue = null;
            if (typeof ref === 'string') {
                refValue = ref.trim();
            } else if (ref && typeof ref === 'object') {
                refValue = (ref.number || ref.referenceNumber || ref.value)?.trim();
            }
            if (refValue && !allReferences.includes(refValue)) {
                allReferences.push(refValue);
            }
        });
    }

    // Additional fields that might contain reference numbers
    const additionalSources = [
        shipment?.customerReferenceNumber,
        shipment?.poNumber,
        shipment?.invoiceNumber,
        shipment?.orderNumber
    ];

    additionalSources.forEach(ref => {
        if (ref && typeof ref === 'string' && ref.trim() && !allReferences.includes(ref.trim())) {
            allReferences.push(ref.trim());
        }
    });
    
    return allReferences;
}

// Helper function to calculate tax vs non-tax totals from charge breakdown with detailed tax breakdown
function calculateInvoiceTotals(chargeBreakdown) {
    let subtotal = 0;  // Non-tax charges
    let taxTotal = 0;  // Total of all taxes
    let taxBreakdown = []; // Individual tax items for Quebec breakdown
    
    console.log(`🍁 calculateInvoiceTotals called with ${chargeBreakdown?.length || 0} charges`);
    
    if (chargeBreakdown && Array.isArray(chargeBreakdown)) {
        chargeBreakdown.forEach((charge, index) => {
            const amount = parseFloat(charge.amount) || 0;
            const isItemTax = charge.isTax || isTaxCharge(charge.code);
            
            if (isItemTax) {
                taxTotal += amount;
                
                // 🍁 QUEBEC TAX BREAKDOWN: Clean code-based categorization
                const code = charge.code ? charge.code.toUpperCase().trim() : '';
                const description = charge.description || charge.name || charge.chargeName || '';
                
                console.log(`🍁 Analyzing tax charge: code="${code}", description="${description}", amount=${amount}`);
                
                // 🎯 ENHANCED DETECTION: Handle both exact codes and provincial variations
                if (code === 'QST' || code.includes('QST')) {
                    console.log(`🍁 ✅ Detected QST by code: ${code}`);
                    taxBreakdown.push({
                        type: 'QST',
                        label: 'QST',
                        amount: amount,
                        code: charge.code,
                        name: description
                    });
                } else if (code === 'QGST' || code.includes('QGST')) {
                    console.log(`🍁 ✅ Detected QGST by code: ${code}`);
                    taxBreakdown.push({
                        type: 'QGST', 
                        label: 'QGST',
                        amount: amount,
                        code: charge.code,
                        name: description
                    });
                } else if (code.includes('GST') && code.includes('QUEBEC')) {
                    // Special case: GST Quebec should be treated as QGST  
                    console.log(`🍁 ✅ Detected Quebec GST (QGST) by code: ${code}`);
                    taxBreakdown.push({
                        type: 'QGST',
                        label: 'QGST',
                        amount: amount,
                        code: charge.code,
                        name: description
                    });
                } else if (code === 'GST' || code.startsWith('GST ')) {
                    console.log(`🍁 ✅ Detected GST by code: ${code}`);
                    taxBreakdown.push({
                        type: 'GST',
                        label: 'GST', 
                        amount: amount,
                        code: charge.code,
                        name: description
                    });
                } else if (code === 'HST' || code.startsWith('HST ')) {
                    console.log(`🍁 ✅ Detected HST by code: ${code}`);
                    taxBreakdown.push({
                        type: 'HST',
                        label: 'HST',
                        amount: amount, 
                        code: charge.code,
                        name: description
                    });
                } else if (code.includes('PST')) {
                    console.log(`🍁 ✅ Detected PST by code: ${code}`);
                    taxBreakdown.push({
                        type: 'PST',
                        label: code, // Use actual code like "PST BC"
                        amount: amount, 
                        code: charge.code,
                        name: description
                    });
                } else {
                    // Fallback: Generic tax using the actual label
                    console.log(`🍁 ✅ Detected Other Tax: ${code || description}`);
                    taxBreakdown.push({
                        type: 'OTHER',
                        label: code || description || 'Tax',
                        amount: amount,
                        code: charge.code,
                        name: description
                    });
                }
            } else {
                subtotal += amount;
            }
        });
    }
    
    // 🍁 CONSOLIDATE DUPLICATE TAX TYPES: Combine multiple entries of same type
    const consolidatedTaxes = {};
    taxBreakdown.forEach(tax => {
        if (consolidatedTaxes[tax.type]) {
            consolidatedTaxes[tax.type].amount += tax.amount;
        } else {
            consolidatedTaxes[tax.type] = { ...tax };
        }
    });
    
    // Convert back to array and sort (Quebec taxes first)
    const sortedTaxBreakdown = Object.values(consolidatedTaxes).sort((a, b) => {
        const priority = { 'QST': 1, 'QGST': 2, 'GST': 3, 'PST': 4, 'HST': 5, 'OTHER': 6 };
        return (priority[a.type] || 5) - (priority[b.type] || 5);
    });
    
    const result = {
        subtotal: Math.round(subtotal * 100) / 100,  // Round to 2 decimal places
        tax: Math.round(taxTotal * 100) / 100,       // Total of all taxes
        total: Math.round((subtotal + taxTotal) * 100) / 100,  // Grand total
        taxBreakdown: sortedTaxBreakdown,  // 🍁 NEW: Individual tax items for detailed display
        hasQuebecTaxes: sortedTaxBreakdown.some(tax => tax.type === 'QST' || tax.type === 'QGST') // 🍁 NEW: Quebec detection flag
    };
    
    console.log(`📊 Enhanced Invoice totals: Subtotal $${result.subtotal} + Taxes $${result.tax} = Total $${result.total}`);
    if (result.hasQuebecTaxes) {
        console.log(`🍁 Quebec taxes detected:`, result.taxBreakdown.filter(tax => tax.type === 'QST' || tax.type === 'QGST'));
    }
    
    return result;
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

// Export helper functions for use in other modules
exports.getSimpleShipmentCharges = getSimpleShipmentCharges;
exports.getSimpleChargeBreakdown = getSimpleChargeBreakdown;
exports.calculateInvoiceTotals = calculateInvoiceTotals;
exports.detectSimpleCurrency = detectSimpleCurrency;
exports.calculateTotalWeight = calculateTotalWeight;
exports.getActualCustomerName = getActualCustomerName;
exports.getCustomerBillingInfo = getCustomerBillingInfo;
exports.getInvoiceCompanyInfo = getInvoiceCompanyInfo;
exports.getAllReferenceNumbers = getAllReferenceNumbers;

// ✅ Note: Tax separation and $0.00 filtering is now active in production 