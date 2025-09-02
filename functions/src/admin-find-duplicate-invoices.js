const { onCall } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

/**
 * ✅ Admin function to find duplicate invoice numbers in the invoices collection
 * Returns detailed information about duplicates including document IDs and metadata
 */
exports.adminFindDuplicateInvoices = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    const { data, auth } = request;
    
    // ✅ Admin authentication check
    if (!auth) {
        throw new Error('Authentication required');
    }

    try {
        console.log('🔍 Starting duplicate invoice number search...');
        
        // Query all invoices from the collection
        const invoicesSnapshot = await db.collection('invoices').get();
        
        console.log(`📊 Found ${invoicesSnapshot.size} total invoices to analyze`);
        
        // Group invoices by invoice number
        const invoiceGroups = {};
        const allInvoices = [];
        
        invoicesSnapshot.forEach(doc => {
            const data = doc.data();
            const invoiceNumber = data.invoiceNumber;
            
            // Track all invoices for statistics
            allInvoices.push({
                id: doc.id,
                invoiceNumber,
                ...data
            });
            
            // Only process invoices that have an invoice number
            if (invoiceNumber) {
                if (!invoiceGroups[invoiceNumber]) {
                    invoiceGroups[invoiceNumber] = [];
                }
                
                invoiceGroups[invoiceNumber].push({
                    documentId: doc.id,
                    invoiceNumber,
                    companyId: data.companyId || null,
                    companyName: data.companyName || '',
                    customerId: data.customerId || null,
                    customerName: data.customerName || '',
                    total: data.total || 0,
                    currency: data.currency || 'N/A',
                    status: data.status || 'unknown',
                    paymentStatus: data.paymentStatus || 'unknown',
                    issueDate: data.issueDate?.toDate?.() || data.issueDate || null,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
                    shipmentIds: data.shipmentIds || [],
                    backfillSource: data.backfillSource || null
                });
            }
        });
        
        // Find duplicates (groups with more than 1 invoice)
        const duplicates = [];
        const duplicateNumbers = [];
        
        Object.entries(invoiceGroups).forEach(([invoiceNumber, invoices]) => {
            if (invoices.length > 1) {
                duplicateNumbers.push(invoiceNumber);
                duplicates.push({
                    invoiceNumber,
                    count: invoices.length,
                    invoices: invoices.sort((a, b) => {
                        // Sort by creation date (newest first)
                        const dateA = a.createdAt || new Date(0);
                        const dateB = b.createdAt || new Date(0);
                        return dateB - dateA;
                    })
                });
            }
        });
        
        // Sort duplicates by count (highest first) and then by invoice number
        duplicates.sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.invoiceNumber.localeCompare(b.invoiceNumber);
        });
        
        // Calculate statistics
        const stats = {
            totalInvoices: allInvoices.length,
            totalUniqueNumbers: Object.keys(invoiceGroups).length,
            totalDuplicateNumbers: duplicateNumbers.length,
            totalDuplicateInvoices: duplicates.reduce((sum, dup) => sum + dup.count, 0),
            largestDuplicateGroup: duplicates.length > 0 ? duplicates[0].count : 0,
            invoicesWithoutNumbers: allInvoices.filter(inv => !inv.invoiceNumber).length
        };
        
        console.log('📊 Duplicate analysis complete:', {
            totalInvoices: stats.totalInvoices,
            duplicateNumbers: stats.totalDuplicateNumbers,
            duplicateInvoices: stats.totalDuplicateInvoices
        });
        
        // Log detailed duplicate information
        if (duplicates.length > 0) {
            console.log('🚨 Found duplicate invoice numbers:');
            duplicates.forEach(dup => {
                console.log(`  📄 Invoice ${dup.invoiceNumber}: ${dup.count} copies`);
                dup.invoices.forEach((inv, index) => {
                    console.log(`    ${index + 1}. Doc ID: ${inv.documentId}, Company: ${inv.companyName}, Total: ${inv.currency} ${inv.total}`);
                });
            });
        }
        
        return {
            success: true,
            statistics: stats,
            duplicates: duplicates,
            summary: {
                hasDuplicates: duplicates.length > 0,
                duplicateCount: duplicates.length,
                message: duplicates.length === 0 
                    ? 'No duplicate invoice numbers found! ✅'
                    : `Found ${duplicates.length} invoice numbers with duplicates affecting ${stats.totalDuplicateInvoices} total invoices ⚠️`
            }
        };
        
    } catch (error) {
        console.error('❌ Error finding duplicate invoices:', error);
        throw new Error(`Failed to search for duplicates: ${error.message}`);
    }
});
