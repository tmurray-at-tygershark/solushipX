import { db, functions } from '../firebase';
import { 
    collection, 
    doc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    orderBy,
    limit,
    Timestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

/**
 * Charges Service
 * Service for managing shipment charges including invoice and EDI numbers
 */

/**
 * Update invoice number for a specific charge in a shipment
 * @param {string} shipmentId - The shipment ID
 * @param {string} chargeCode - The charge code (e.g., 'FRT', 'FUE')
 * @param {string} invoiceNumber - The invoice number to set
 * @returns {Promise<boolean>} - Success status
 */
export const updateChargeInvoiceNumber = async (shipmentId, chargeCode, invoiceNumber) => {
    try {
        const updateShipmentCharges = httpsCallable(functions, 'updateShipmentCharges');
        
        // First, get the current charges
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        const currentCharges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
        
        // Update the specific charge
        const updatedCharges = currentCharges.map(charge => {
            if (charge.code === chargeCode) {
                return {
                    ...charge,
                    invoiceNumber: invoiceNumber || '-'
                };
            }
            return charge;
        });
        
        // Save back to database
        const result = await updateShipmentCharges({
            shipmentId,
            charges: updatedCharges
        });
        
        return result.data?.success || false;
    } catch (error) {
        console.error('Error updating charge invoice number:', error);
        throw error;
    }
};

/**
 * Update EDI number for a specific charge in a shipment
 * @param {string} shipmentId - The shipment ID
 * @param {string} chargeCode - The charge code (e.g., 'FRT', 'FUE')
 * @param {string} ediNumber - The EDI number to set
 * @returns {Promise<boolean>} - Success status
 */
export const updateChargeEdiNumber = async (shipmentId, chargeCode, ediNumber) => {
    try {
        const updateShipmentCharges = httpsCallable(functions, 'updateShipmentCharges');
        
        // First, get the current charges
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        const currentCharges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
        
        // Update the specific charge
        const updatedCharges = currentCharges.map(charge => {
            if (charge.code === chargeCode) {
                return {
                    ...charge,
                    ediNumber: ediNumber || '-'
                };
            }
            return charge;
        });
        
        // Save back to database
        const result = await updateShipmentCharges({
            shipmentId,
            charges: updatedCharges
        });
        
        return result.data?.success || false;
    } catch (error) {
        console.error('Error updating charge EDI number:', error);
        throw error;
    }
};

/**
 * Update both invoice and EDI numbers for a specific charge
 * @param {string} shipmentId - The shipment ID
 * @param {string} chargeCode - The charge code (e.g., 'FRT', 'FUE')
 * @param {string} invoiceNumber - The invoice number to set
 * @param {string} ediNumber - The EDI number to set
 * @returns {Promise<boolean>} - Success status
 */
export const updateChargeInvoiceAndEdi = async (shipmentId, chargeCode, invoiceNumber, ediNumber) => {
    try {
        const updateShipmentCharges = httpsCallable(functions, 'updateShipmentCharges');
        
        // First, get the current charges
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        const currentCharges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
        
        // Update the specific charge
        const updatedCharges = currentCharges.map(charge => {
            if (charge.code === chargeCode) {
                return {
                    ...charge,
                    invoiceNumber: invoiceNumber || '-',
                    ediNumber: ediNumber || '-'
                };
            }
            return charge;
        });
        
        // Save back to database
        const result = await updateShipmentCharges({
            shipmentId,
            charges: updatedCharges
        });
        
        return result.data?.success || false;
    } catch (error) {
        console.error('Error updating charge invoice and EDI numbers:', error);
        throw error;
    }
};

/**
 * Bulk update invoice numbers for multiple charges in a shipment
 * @param {string} shipmentId - The shipment ID
 * @param {Array<{chargeCode: string, invoiceNumber: string}>} updates - Array of charge updates
 * @returns {Promise<boolean>} - Success status
 */
export const bulkUpdateInvoiceNumbers = async (shipmentId, updates) => {
    try {
        const updateShipmentCharges = httpsCallable(functions, 'updateShipmentCharges');
        
        // First, get the current charges
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        const currentCharges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
        
        // Create a map for quick lookup
        const updateMap = new Map();
        updates.forEach(update => {
            updateMap.set(update.chargeCode, update.invoiceNumber);
        });
        
        // Update the charges
        const updatedCharges = currentCharges.map(charge => {
            if (updateMap.has(charge.code)) {
                return {
                    ...charge,
                    invoiceNumber: updateMap.get(charge.code) || '-'
                };
            }
            return charge;
        });
        
        // Save back to database
        const result = await updateShipmentCharges({
            shipmentId,
            charges: updatedCharges
        });
        
        return result.data?.success || false;
    } catch (error) {
        console.error('Error bulk updating invoice numbers:', error);
        throw error;
    }
};

/**
 * Bulk update EDI numbers for multiple charges in a shipment
 * @param {string} shipmentId - The shipment ID
 * @param {Array<{chargeCode: string, ediNumber: string}>} updates - Array of charge updates
 * @returns {Promise<boolean>} - Success status
 */
export const bulkUpdateEdiNumbers = async (shipmentId, updates) => {
    try {
        const updateShipmentCharges = httpsCallable(functions, 'updateShipmentCharges');
        
        // First, get the current charges
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error('Shipment not found');
        }
        
        const shipmentData = shipmentDoc.data();
        const currentCharges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
        
        // Create a map for quick lookup
        const updateMap = new Map();
        updates.forEach(update => {
            updateMap.set(update.chargeCode, update.ediNumber);
        });
        
        // Update the charges
        const updatedCharges = currentCharges.map(charge => {
            if (updateMap.has(charge.code)) {
                return {
                    ...charge,
                    ediNumber: updateMap.get(charge.code) || '-'
                };
            }
            return charge;
        });
        
        // Save back to database
        const result = await updateShipmentCharges({
            shipmentId,
            charges: updatedCharges
        });
        
        return result.data?.success || false;
    } catch (error) {
        console.error('Error bulk updating EDI numbers:', error);
        throw error;
    }
};

/**
 * Get shipments with missing invoice numbers
 * @param {string} companyId - The company ID to filter by
 * @param {number} limit - Maximum number of results (default: 50)
 * @returns {Promise<Array>} - Array of shipments with missing invoice numbers
 */
export const getShipmentsWithMissingInvoiceNumbers = async (companyId, limitCount = 50) => {
    try {
        const shipmentsRef = collection(db, 'shipments');
        const q = query(
            shipmentsRef,
            where('companyID', '==', companyId),
            where('status', 'in', ['delivered', 'completed']),
            orderBy('bookedAt', 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        const shipments = [];
        
        snapshot.forEach(doc => {
            const shipmentData = doc.data();
            const charges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
            
            // Check if any charges are missing invoice numbers
            const hasMissingInvoiceNumbers = charges.some(charge => 
                !charge.invoiceNumber || charge.invoiceNumber === '-'
            );
            
            if (hasMissingInvoiceNumbers) {
                shipments.push({
                    id: doc.id,
                    ...shipmentData,
                    charges
                });
            }
        });
        
        return shipments;
    } catch (error) {
        console.error('Error getting shipments with missing invoice numbers:', error);
        throw error;
    }
};

/**
 * Get shipments with missing EDI numbers
 * @param {string} companyId - The company ID to filter by
 * @param {number} limit - Maximum number of results (default: 50)
 * @returns {Promise<Array>} - Array of shipments with missing EDI numbers
 */
export const getShipmentsWithMissingEdiNumbers = async (companyId, limitCount = 50) => {
    try {
        const shipmentsRef = collection(db, 'shipments');
        const q = query(
            shipmentsRef,
            where('companyID', '==', companyId),
            where('status', 'in', ['delivered', 'completed']),
            orderBy('bookedAt', 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        const shipments = [];
        
        snapshot.forEach(doc => {
            const shipmentData = doc.data();
            const charges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
            
            // Check if any charges are missing EDI numbers
            const hasMissingEdiNumbers = charges.some(charge => 
                !charge.ediNumber || charge.ediNumber === '-'
            );
            
            if (hasMissingEdiNumbers) {
                shipments.push({
                    id: doc.id,
                    ...shipmentData,
                    charges
                });
            }
        });
        
        return shipments;
    } catch (error) {
        console.error('Error getting shipments with missing EDI numbers:', error);
        throw error;
    }
};

/**
 * Generate invoice/EDI tracking report
 * @param {string} companyId - The company ID to filter by
 * @param {Date} startDate - Start date for the report
 * @param {Date} endDate - End date for the report
 * @returns {Promise<Object>} - Report data with statistics
 */
export const generateInvoiceEdiReport = async (companyId, startDate, endDate) => {
    try {
        const shipmentsRef = collection(db, 'shipments');
        const q = query(
            shipmentsRef,
            where('companyID', '==', companyId),
            where('bookedAt', '>=', Timestamp.fromDate(startDate)),
            where('bookedAt', '<=', Timestamp.fromDate(endDate)),
            orderBy('bookedAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const report = {
            totalShipments: 0,
            shipmentsWithInvoiceNumbers: 0,
            shipmentsWithEdiNumbers: 0,
            shipmentsWithBoth: 0,
            shipmentsWithNeither: 0,
            chargeBreakdown: {
                totalCharges: 0,
                chargesWithInvoiceNumbers: 0,
                chargesWithEdiNumbers: 0,
                chargesWithBoth: 0,
                chargesWithNeither: 0
            },
            shipmentDetails: []
        };
        
        snapshot.forEach(doc => {
            const shipmentData = doc.data();
            const charges = shipmentData.updatedCharges || shipmentData.chargesBreakdown || [];
            
            report.totalShipments++;
            
            let hasAnyInvoiceNumber = false;
            let hasAnyEdiNumber = false;
            let chargeStats = {
                total: charges.length,
                withInvoice: 0,
                withEdi: 0,
                withBoth: 0,
                withNeither: 0
            };
            
            charges.forEach(charge => {
                report.chargeBreakdown.totalCharges++;
                
                const hasInvoice = charge.invoiceNumber && charge.invoiceNumber !== '-';
                const hasEdi = charge.ediNumber && charge.ediNumber !== '-';
                
                if (hasInvoice) {
                    hasAnyInvoiceNumber = true;
                    report.chargeBreakdown.chargesWithInvoiceNumbers++;
                    chargeStats.withInvoice++;
                }
                
                if (hasEdi) {
                    hasAnyEdiNumber = true;
                    report.chargeBreakdown.chargesWithEdiNumbers++;
                    chargeStats.withEdi++;
                }
                
                if (hasInvoice && hasEdi) {
                    report.chargeBreakdown.chargesWithBoth++;
                    chargeStats.withBoth++;
                } else if (!hasInvoice && !hasEdi) {
                    report.chargeBreakdown.chargesWithNeither++;
                    chargeStats.withNeither++;
                }
            });
            
            if (hasAnyInvoiceNumber) report.shipmentsWithInvoiceNumbers++;
            if (hasAnyEdiNumber) report.shipmentsWithEdiNumbers++;
            if (hasAnyInvoiceNumber && hasAnyEdiNumber) report.shipmentsWithBoth++;
            if (!hasAnyInvoiceNumber && !hasAnyEdiNumber) report.shipmentsWithNeither++;
            
            report.shipmentDetails.push({
                id: doc.id,
                shipmentID: shipmentData.shipmentID,
                status: shipmentData.status,
                bookedAt: shipmentData.bookedAt,
                hasInvoiceNumbers: hasAnyInvoiceNumber,
                hasEdiNumbers: hasAnyEdiNumber,
                chargeStats
            });
        });
        
        return report;
    } catch (error) {
        console.error('Error generating invoice/EDI report:', error);
        throw error;
    }
};

/**
 * Calculate billing metrics from shipment data
 * @param {Object} params - Parameters object
 * @param {Object} params.filters - Filter parameters (startDate, endDate, companyId, etc)
 * @param {string} params.userRole - User role ('superadmin', 'admin', 'user')
 * @param {Array} params.connectedCompanies - Array of connected company IDs for admins
 * @returns {Promise<Object>} - Metrics object with totals by currency
 */
export const calculateMetrics = async ({ filters, userRole, connectedCompanies }) => {
    try {
        // Build Firestore query based on user role and filters
        let shipmentsQuery = collection(db, 'shipments');
        const queryConstraints = [where('status', '!=', 'draft')];

        // Apply date filters
        if (filters.startDate) {
            queryConstraints.push(where('createdAt', '>=', Timestamp.fromDate(new Date(filters.startDate))));
        }
        if (filters.endDate) {
            queryConstraints.push(where('createdAt', '<=', Timestamp.fromDate(new Date(filters.endDate))));
        }

        // Apply company filtering based on user role
        if (userRole !== 'superadmin' && connectedCompanies && connectedCompanies.length > 0) {
            // Regular admin: filter by connected companies
            const companyBatches = [];
            for (let i = 0; i < connectedCompanies.length; i += 10) {
                const batch = connectedCompanies.slice(i, i + 10);
                companyBatches.push(batch);
            }
            
            // For simplicity, take first batch (can be enhanced for multiple batches)
            if (companyBatches.length > 0) {
                queryConstraints.push(where('companyID', 'in', companyBatches[0]));
            }
        }

        // Apply specific company filter if selected
        if (filters.companyId) {
            queryConstraints.push(where('companyID', '==', filters.companyId));
        }

        // Add orderBy for consistent results
        queryConstraints.push(orderBy('createdAt', 'desc'));

        // Execute query
        const shipmentsSnapshot = await getDocs(query(shipmentsQuery, ...queryConstraints));
        const shipmentsData = shipmentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Helper function to get shipment currency
        const getShipmentCurrency = (shipment) => {
            return shipment.currency || 
                   shipment.selectedRate?.currency || 
                   shipment.manualRates?.[0]?.currency || 
                   'USD';
        };

        // Initialize metrics by currency
        const metrics = {
            totalShipments: { USD: 0, CAD: 0 },
            totalRevenue: { USD: 0, CAD: 0 },
            totalCosts: { USD: 0, CAD: 0 }
        };

        // Process each shipment
        shipmentsData.forEach(shipment => {
            const currency = getShipmentCurrency(shipment);
            
            // Count shipments by currency
            metrics.totalShipments[currency] = (metrics.totalShipments[currency] || 0) + 1;

            // Calculate revenue (customer charges)
            let charge = 0;
            if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
                // QuickShip: sum up manual rates
                charge = shipment.manualRates.reduce((sum, rate) => {
                    return sum + (parseFloat(rate.charge) || 0);
                }, 0);
            } else {
                // Regular shipments: use dual rate system
                charge = shipment.markupRates?.totalCharges ||
                        shipment.totalCharges ||
                        shipment.selectedRate?.totalCharges || 0;
            }
            metrics.totalRevenue[currency] = (metrics.totalRevenue[currency] || 0) + charge;

            // Calculate costs
            let cost = 0;
            if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
                // QuickShip: sum up manual costs
                cost = shipment.manualRates.reduce((sum, rate) => {
                    return sum + (parseFloat(rate.cost) || 0);
                }, 0);
            } else {
                // Regular shipments: use actual rates or fallback
                cost = shipment.actualRates?.totalCharges ||
                       shipment.totalCosts ||
                       shipment.selectedRate?.totalCharges || 0;
            }
            metrics.totalCosts[currency] = (metrics.totalCosts[currency] || 0) + cost;
        });

        return metrics;
    } catch (error) {
        console.error('Error calculating metrics:', error);
        // Return default metrics structure on error
        return {
            totalShipments: { USD: 0, CAD: 0 },
            totalRevenue: { USD: 0, CAD: 0 },
            totalCosts: { USD: 0, CAD: 0 }
        };
    }
};

/**
 * Fetch connected companies for a user
 * @param {string} userId - The user ID
 * @param {string} userRole - The user role ('superadmin', 'admin', 'user')
 * @returns {Promise<Array>} - Array of company IDs
 */
export const fetchConnectedCompanies = async (userId, userRole) => {
    try {
        if (!userId) {
            return [];
        }

        let companyIds = [];

        if (userRole === 'superadmin') {
            // Super admin can see all companies
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            companyIds = companiesSnapshot.docs.map(doc => doc.data().companyID || doc.id);
        } else if (userRole === 'admin') {
            // Regular admin sees connected companies
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.data();

            if (userData?.connectedCompanies && userData.connectedCompanies.length > 0) {
                companyIds = userData.connectedCompanies;
            }
        }

        return companyIds;
    } catch (error) {
        console.error('Error fetching connected companies:', error);
        return [];
    }
};

const chargesService = {
    updateChargeInvoiceNumber,
    updateChargeEdiNumber,
    updateChargeInvoiceAndEdi,
    bulkUpdateInvoiceNumbers,
    bulkUpdateEdiNumbers,
    getShipmentsWithMissingInvoiceNumbers,
    getShipmentsWithMissingEdiNumbers,
    generateInvoiceEdiReport,
    fetchConnectedCompanies,
    calculateMetrics
};

export default chargesService; 