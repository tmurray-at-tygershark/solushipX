import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    getDoc,
    doc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import invoiceStatusService from './invoiceStatusService';

class ChargesService {
    constructor() {
        this.companyCache = new Map();
        this.customerCache = new Map();
    }

    /**
     * Get invoice status for a shipment
     */
    async getInvoiceStatus(shipment) {
        try {
            // Check if shipment has an explicit invoice status
            if (shipment.invoiceStatus) {
                return shipment.invoiceStatus;
            }

            // Check for billing data or invoice references
            if (shipment.invoiceId || shipment.invoiceNumber) {
                return 'invoiced';
            }

            // Check for payment status
            if (shipment.paymentStatus === 'paid' || shipment.paid === true) {
                return 'paid';
            }

            // Default to uninvoiced
            return 'uninvoiced';
        } catch (error) {
            console.error('Error determining invoice status:', error);
            return 'uninvoiced';
        }
    }

    /**
     * Filter charges by invoice status using dynamic status mapping
     */
    async filterByInvoiceStatus(charges, statusFilter) {
        if (!statusFilter) {
            return charges;
        }

        try {
            // Get dynamic status mapping from invoice status service
            const statusMapping = await invoiceStatusService.getStatusMapping();
            
            // Get the appropriate status codes for the filter
            const allowedStatusCodes = statusMapping[statusFilter]?.codes || [statusFilter];

            return charges.filter(charge => {
                return allowedStatusCodes.includes(charge.status);
            });
        } catch (error) {
            console.error('Error filtering by invoice status:', error);
            // Fallback to basic filtering
            return charges.filter(charge => {
                if (statusFilter === 'uninvoiced') {
                    return !charge.status || charge.status === 'uninvoiced';
                } else if (statusFilter === 'invoiced') {
                    return charge.status === 'invoiced';
                } else if (statusFilter === 'paid') {
                    return charge.status === 'paid';
                } else {
                    return charge.status === statusFilter;
                }
            });
        }
    }

    /**
     * Simple, working charges fetcher - no complex pagination
     */
    async fetchCharges({ filters = {}, userRole, connectedCompanies = [] }) {
        try {
            console.log('🔄 Fetching charges with filters:', filters);
            
            // 1. Build simple query
            let shipmentsQuery = collection(db, 'shipments');
            const constraints = [];

            // Company filtering for non-super admins
            if (userRole !== 'superadmin' && connectedCompanies?.length > 0) {
                // Simple approach: take first 10 companies to avoid Firestore limits
                const companies = connectedCompanies.slice(0, 10);
                if (companies.length > 0) {
                    constraints.push(where('companyID', 'in', companies));
                }
            }

            // Add ordering
            constraints.push(orderBy('createdAt', 'desc'));
            
            // Add limit
            constraints.push(limit(100));

            // Build final query
            if (constraints.length > 0) {
                shipmentsQuery = query(shipmentsQuery, ...constraints);
            }

            // 2. Execute query
            console.log('📡 Executing Firestore query...');
            const snapshot = await getDocs(shipmentsQuery);
            const shipments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('📦 Raw shipments fetched:', shipments.length);

            // 3. Simple filtering (client-side)
            const filteredShipments = shipments.filter(s => {
                // Filter out archived/draft shipments
                const status = String(s.status || '').toLowerCase();
                if (['archived', 'draft', 'deleted', 'cancelled', 'void'].includes(status)) {
                    return false;
                }

                // Company filter
                if (filters.companyId && s.companyID !== filters.companyId) {
                    return false;
                }

                // Search filter
                if (filters.searchTerm) {
                    const searchTerm = filters.searchTerm.toLowerCase();
                    const searchFields = [
                        s.shipmentID,
                        s.companyID,
                        s.customerName,
                        s.customerId
                    ].filter(Boolean).join(' ').toLowerCase();
                    
                    if (!searchFields.includes(searchTerm)) {
                        return false;
                    }
                }

                return true;
            });

            console.log('✅ Filtered shipments:', filteredShipments.length);

            // 4. Load reference data
            await this.loadReferenceData(filteredShipments);

            // 5. Process into charges
            const charges = await Promise.all(filteredShipments.map(shipment => this.processShipmentToCharge(shipment)));

            // 6. Apply sorting
            this.sortCharges(charges, filters.sortField, filters.sortDirection);

            console.log('💰 Final charges:', charges.length);

            return {
                charges,
                totalCount: charges.length,
                hasMore: false,
                lastDoc: null
            };

        } catch (error) {
            console.error('❌ Error in fetchCharges:', error);
            throw error;
        }
    }

    /**
     * Load company and customer data
     */
    async loadReferenceData(shipments) {
        try {
            // Get unique company IDs
            const companyIds = [...new Set(shipments.map(s => s.companyID).filter(Boolean))];
            
            // Load companies
            for (const companyId of companyIds) {
                if (!this.companyCache.has(companyId)) {
                    try {
                        const companyQuery = query(
                            collection(db, 'companies'),
                            where('companyID', '==', companyId),
                            limit(1)
                        );
                        const companySnapshot = await getDocs(companyQuery);
                        if (!companySnapshot.empty) {
                            const companyData = companySnapshot.docs[0].data();
                            this.companyCache.set(companyId, {
                                id: companySnapshot.docs[0].id,
                                name: companyData.name || companyId,
                                logoUrl: companyData.logoUrl || companyData.logo
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Error loading company:', companyId, error);
                    }
                }
            }

            // Get unique customer IDs
            const customerIds = [...new Set(shipments.map(s => 
                s.customerId || s.customerID
            ).filter(Boolean))];
            
            // Load customers - using exact ShipmentInformation.jsx approach
            for (const customerId of customerIds) {
                if (!this.customerCache.has(customerId)) {
                    try {
                        // FIRST: Try to get customer by document ID (direct lookup)
                        const customerDocRef = doc(db, 'customers', customerId);
                        const customerDocSnapshot = await getDoc(customerDocRef);

                        if (customerDocSnapshot.exists()) {
                            const customerData = customerDocSnapshot.data();
                            this.customerCache.set(customerId, {
                                id: customerDocSnapshot.id,
                                name: customerData.name || customerData.companyName || 'Unknown Customer',
                                logoUrl: customerData.logoUrl || customerData.logo
                            });
                            continue;
                        }

                        // SECOND: Try to query by customerID field
                        const customerQuery = query(
                            collection(db, 'customers'),
                            where('customerID', '==', customerId),
                            limit(1)
                        );
                        const customerSnapshot = await getDocs(customerQuery);

                        if (!customerSnapshot.empty) {
                            const customerDoc = customerSnapshot.docs[0];
                            const customerData = customerDoc.data();
                            this.customerCache.set(customerId, {
                                id: customerDoc.id,
                                name: customerData.name || customerData.companyName || 'Unknown Customer',
                                logoUrl: customerData.logoUrl || customerData.logo
                            });
                        }
                    } catch (error) {
                        console.warn('⚠️ Error loading customer:', customerId, error);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error loading reference data:', error);
        }
    }

    /**
     * Convert shipment to charge object
     */
    async processShipmentToCharge(shipment) {
        // Get company data
        const company = this.companyCache.get(shipment.companyID) || {};
        
        // Get customer data - ENHANCED: Check for customer ID in all possible locations including address records
        const customerId = shipment.customerId ||
            shipment.customerID ||
            shipment.customer?.id ||
            shipment.shipFrom?.customerID ||
            shipment.shipTo?.customerID ||
            shipment.shipFrom?.customerId ||
            shipment.shipTo?.customerId;
        
        // Debug logging for specific shipment
        if (shipment.shipmentID === 'TS-21BWNG') {
            console.log('🔍 Debug TS-21BWNG customer lookup:', {
                shipmentID: shipment.shipmentID,
                foundCustomerId: customerId,
                customerId: shipment.customerId,
                customerID: shipment.customerID,
                customerInCache: customerId ? this.customerCache.has(customerId) : false,
                allShipmentKeys: Object.keys(shipment)
            });
        }
        const customer = customerId ? this.customerCache.get(customerId) : null;

        // Extract costs and charges
        const { actualCost, customerCharge, currency } = this.extractCostData(shipment);

        // Calculate margin
        const margin = customerCharge - actualCost;
        const marginPercent = actualCost > 0 ? (margin / actualCost) * 100 : 0;

        return {
            id: shipment.id,
            shipmentID: shipment.shipmentID || shipment.id,
            shipmentDate: this.extractDate(shipment),
            companyID: shipment.companyID,
            companyName: company.name || shipment.companyID || 'Unknown Company',
            companyLogo: company.logoUrl,
            customerName: customer?.name || shipment.customerName || 'Unknown Customer',
            customerLogo: customer?.logoUrl,
            carrierName: this.extractCarrierName(shipment),
            serviceName: this.extractServiceName(shipment),
            actualCost,
            customerCharge,
            margin,
            marginPercent,
            currency,
            status: await this.getInvoiceStatus(shipment), // Dynamic invoice status
            shipmentStatus: shipment.status || 'unknown',
            shipmentSubStatus: shipment.subStatus,
            hasManualOverride: shipment.statusOverride?.isManual === true,
            isQuickShip: shipment.creationMethod === 'quickship',
            route: this.formatRoute(shipment)
        };
    }

    /**
     * Extract cost and charge data from shipment
     */
    extractCostData(shipment) {
        let actualCost = 0;
        let customerCharge = 0;
        let currency = 'CAD';

        try {
            // QuickShip manual rates
            if (shipment.manualRates && Array.isArray(shipment.manualRates)) {
                const totals = shipment.manualRates.reduce((acc, rate) => {
                    const cost = parseFloat(rate.cost) || 0;
                    const charge = parseFloat(rate.charge) || 0;
                    return {
                        cost: acc.cost + cost,
                        charge: acc.charge + charge
                    };
                }, { cost: 0, charge: 0 });
                
                actualCost = totals.cost;
                customerCharge = totals.charge;
                currency = shipment.manualRates[0]?.chargeCurrency || 'CAD';
            }
            // Regular shipments with markup rates
            else if (shipment.markupRates?.totalCharges && shipment.actualRates?.totalCharges) {
                actualCost = parseFloat(shipment.actualRates.totalCharges) || 0;
                customerCharge = parseFloat(shipment.markupRates.totalCharges) || 0;
                currency = shipment.markupRates.currency || shipment.currency || 'CAD';
            }
            // Fallback to any available rate data
            else if (shipment.selectedRate) {
                actualCost = parseFloat(shipment.selectedRate.totalCharges) || 0;
                customerCharge = actualCost; // No markup data available
                currency = shipment.selectedRate.currency || 'CAD';
            }

        } catch (error) {
            console.warn('⚠️ Error extracting cost data for shipment:', shipment.shipmentID, error);
        }

        return { actualCost, customerCharge, currency };
    }

    /**
     * Extract carrier name
     */
    extractCarrierName(shipment) {
        return shipment.selectedCarrier?.name ||
               shipment.selectedCarrier ||
               shipment.carrier?.name ||
               shipment.carrier ||
               shipment.selectedRate?.carrier?.name ||
               'Unknown Carrier';
    }

    /**
     * Extract service name
     */
    extractServiceName(shipment) {
        return shipment.selectedRate?.service?.name ||
               shipment.serviceName ||
               shipment.service ||
               'Standard Service';
    }

    /**
     * Extract shipment date
     */
    extractDate(shipment) {
        const dateFields = [
            shipment.shipmentInfo?.shipmentDate,
            shipment.shipmentDate,
            shipment.bookedAt,
            shipment.createdAt
        ];

        for (const field of dateFields) {
            if (field) {
                try {
                    if (field && typeof field.toDate === 'function') {
                        return field.toDate();
                    }
                    if (field && typeof field === 'object' && field.seconds) {
                        return new Date(field.seconds * 1000);
                    }
                    const date = new Date(field);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                } catch (error) {
                    continue;
                }
            }
        }

        return new Date(); // Fallback
    }

    /**
     * Format route string
     */
    formatRoute(shipment) {
        const from = shipment.shipFrom || shipment.origin;
        const to = shipment.shipTo || shipment.destination;

        if (!from || !to) return 'N/A';

        const fromCity = from.city || 'Unknown';
        const fromState = from.state || from.province || '';
        const toCity = to.city || 'Unknown';
        const toState = to.state || to.province || '';

        return `${fromCity}, ${fromState} →\n${toCity}, ${toState}`;
    }

    /**
     * Sort charges array
     */
    sortCharges(charges, sortField = 'shipmentDate', sortDirection = 'desc') {
        charges.sort((a, b) => {
            let valueA, valueB;

            switch (sortField) {
                case 'shipmentDate':
                    valueA = new Date(a.shipmentDate);
                    valueB = new Date(b.shipmentDate);
                    break;
                case 'companyName':
                    valueA = a.companyName || '';
                    valueB = b.companyName || '';
                    return sortDirection === 'asc' 
                        ? valueA.localeCompare(valueB)
                        : valueB.localeCompare(valueA);
                case 'customerName':
                    valueA = a.customerName || '';
                    valueB = b.customerName || '';
                    return sortDirection === 'asc' 
                        ? valueA.localeCompare(valueB)
                        : valueB.localeCompare(valueA);
                case 'actualCost':
                    valueA = a.actualCost || 0;
                    valueB = b.actualCost || 0;
                    break;
                case 'customerCharge':
                    valueA = a.customerCharge || 0;
                    valueB = b.customerCharge || 0;
                    break;
                case 'margin':
                    valueA = a.margin || 0;
                    valueB = b.margin || 0;
                    break;
                default:
                    valueA = new Date(a.shipmentDate);
                    valueB = new Date(b.shipmentDate);
            }

            if (sortDirection === 'asc') {
                return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
            } else {
                return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
            }
        });
    }

    /**
     * Calculate summary metrics
     */
    async calculateMetrics({ filters = {}, userRole, connectedCompanies = [] }) {
        try {
            // Use the same fetch logic to get all relevant shipments
            const result = await this.fetchCharges({ filters, userRole, connectedCompanies });
            const charges = result.charges;

            // Group by currency and calculate totals
            const metrics = {
                totalShipments: { USD: 0, CAD: 0 },
                totalRevenue: { USD: 0, CAD: 0 },
                totalCosts: { USD: 0, CAD: 0 }
            };

            charges.forEach(charge => {
                const currency = (charge.currency || 'CAD').toUpperCase();
                
                if (currency === 'USD' || currency === 'CAD') {
                    metrics.totalShipments[currency]++;
                    metrics.totalRevenue[currency] += charge.customerCharge || 0;
                    metrics.totalCosts[currency] += charge.actualCost || 0;
                }
            });

            return metrics;

        } catch (error) {
            console.error('❌ Error calculating metrics:', error);
            throw error;
        }
    }

    /**
     * Get connected companies for a user
     */
    async fetchConnectedCompanies(userId, userRole) {
        try {
            if (userRole === 'superadmin') {
                return []; // Super admins see all companies
            }

            // For regular admins, get their connected companies
            const userQuery = query(
                collection(db, 'users'),
                where('uid', '==', userId),
                limit(1)
            );
            
            const userSnapshot = await getDocs(userQuery);
            if (userSnapshot.empty) {
                return [];
            }

            const userData = userSnapshot.docs[0].data();
            return userData.connectedCompanies || [];

        } catch (error) {
            console.error('❌ Error fetching connected companies:', error);
            return [];
        }
    }
}

// Export singleton instance
export default new ChargesService(); 