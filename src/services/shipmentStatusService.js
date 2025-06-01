/**
 * Shipment Status Service
 * Provides unified status checking across different carriers
 */

import { db } from '../firebase';
import { collection, doc, updateDoc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { SHIPMENT_STATUSES, normalizeShipmentStatus, STATUS_DISPLAY_NAMES } from '../utils/universalDataModel';

// Polling intervals (in milliseconds)
const POLLING_INTERVALS = {
    ACTIVE: 5 * 60 * 1000,    // 5 minutes for active shipments
    PENDING: 30 * 60 * 1000,  // 30 minutes for pending shipments
    DELIVERED: 0,             // No polling for delivered shipments
    EXCEPTION: 10 * 60 * 1000, // 10 minutes for exception statuses
    DRAFT: 0                  // No polling for draft shipments
};

// Status check priorities
const STATUS_PRIORITIES = {
    [SHIPMENT_STATUSES.IN_TRANSIT]: 1,
    [SHIPMENT_STATUSES.SCHEDULED]: 2,
    [SHIPMENT_STATUSES.BOOKED]: 3,
    [SHIPMENT_STATUSES.AWAITING_SHIPMENT]: 4,
    [SHIPMENT_STATUSES.ON_HOLD]: 5,
    [SHIPMENT_STATUSES.PENDING]: 6,
    [SHIPMENT_STATUSES.DELIVERED]: 7,
    [SHIPMENT_STATUSES.CANCELED]: 8,
    [SHIPMENT_STATUSES.VOID]: 9,
    [SHIPMENT_STATUSES.DRAFT]: 10
};

/**
 * Main ShipmentStatusService class
 */
export class ShipmentStatusService {
    constructor() {
        this.pollingIntervals = new Map();
        this.isPolling = false;
    }

    /**
     * Start polling for shipment status updates
     */
    startPolling(companyId) {
        if (this.isPolling) {
            console.log('Status polling already running');
            return;
        }

        this.isPolling = true;
        this.pollShipmentStatuses(companyId);
        
        console.log('Started shipment status polling for company:', companyId);
    }

    /**
     * Stop polling for status updates
     */
    stopPolling() {
        this.isPolling = false;
        this.pollingIntervals.forEach((interval) => {
            clearTimeout(interval);
        });
        this.pollingIntervals.clear();
        
        console.log('Stopped shipment status polling');
    }

    /**
     * Main polling function
     */
    async pollShipmentStatuses(companyId) {
        if (!this.isPolling) return;

        try {
            // Get shipments that need status checking
            const shipments = await this.getShipmentsForStatusCheck(companyId);
            
            if (shipments.length === 0) {
                console.log('No shipments requiring status updates');
                this.scheduleNextPoll(companyId, POLLING_INTERVALS.PENDING);
                return;
            }

            console.log(`Checking status for ${shipments.length} shipments`);

            // Process shipments by carrier
            const carrierGroups = this.groupShipmentsByCarrier(shipments);
            
            for (const [carrier, carrierShipments] of carrierGroups) {
                await this.checkCarrierShipments(carrier, carrierShipments);
            }

            // Schedule next poll
            const nextInterval = this.calculateNextPollInterval(shipments);
            this.scheduleNextPoll(companyId, nextInterval);

        } catch (error) {
            console.error('Error in status polling:', error);
            // Retry with longer interval on error
            this.scheduleNextPoll(companyId, POLLING_INTERVALS.EXCEPTION);
        }
    }

    /**
     * Get shipments that need status checking
     */
    async getShipmentsForStatusCheck(companyId) {
        try {
            const shipmentsRef = collection(db, 'shipments');
            const q = query(
                shipmentsRef,
                where('companyID', '==', companyId),
                where('status', 'in', [
                    SHIPMENT_STATUSES.BOOKED,
                    SHIPMENT_STATUSES.SCHEDULED,
                    SHIPMENT_STATUSES.AWAITING_SHIPMENT,
                    SHIPMENT_STATUSES.IN_TRANSIT,
                    SHIPMENT_STATUSES.ON_HOLD
                ]),
                orderBy('createdAt', 'desc'),
                limit(50) // Limit to prevent overwhelming the system
            );

            const snapshot = await getDocs(q);
            const shipments = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Only include shipments with tracking information
                if (data.confirmationNumber || data.trackingNumber || data.proNumber) {
                    shipments.push({
                        id: doc.id,
                        ...data
                    });
                }
            });

            return shipments;
        } catch (error) {
            console.error('Error fetching shipments for status check:', error);
            return [];
        }
    }

    /**
     * Group shipments by carrier
     */
    groupShipmentsByCarrier(shipments) {
        const groups = new Map();

        shipments.forEach(shipment => {
            const carrier = this.getShipmentCarrier(shipment);
            if (!groups.has(carrier)) {
                groups.set(carrier, []);
            }
            groups.get(carrier).push(shipment);
        });

        return groups;
    }

    /**
     * Get carrier information from shipment
     */
    getShipmentCarrier(shipment) {
        // Try multiple fields to determine carrier
        return shipment.carrier || 
               shipment.selectedRate?.carrier?.id ||
               shipment.selectedRateRef?.carrier ||
               shipment.carrierKey ||
               'UNKNOWN';
    }

    /**
     * Check status for shipments of a specific carrier
     */
    async checkCarrierShipments(carrier, shipments) {
        console.log(`Checking ${shipments.length} shipments for carrier: ${carrier}`);

        switch (carrier.toUpperCase()) {
            case 'ESHIPPLUS':
            case 'ESHIP':
                await this.checkEShipPlusStatuses(shipments);
                break;
            case 'CANPAR':
                await this.checkCanparStatuses(shipments);
                break;
            case 'FEDEX':
                await this.checkFedExStatuses(shipments);
                break;
            case 'UPS':
                await this.checkUPSStatuses(shipments);
                break;
            default:
                console.log(`Status checking not implemented for carrier: ${carrier}`);
        }
    }

    /**
     * Check eShip Plus shipment statuses
     */
    async checkEShipPlusStatuses(shipments) {
        for (const shipment of shipments) {
            try {
                await this.checkEShipPlusStatus(shipment);
                
                // Add delay between requests to avoid rate limiting
                await this.delay(1000);
            } catch (error) {
                console.error(`Error checking eShip Plus status for shipment ${shipment.id}:`, error);
            }
        }
    }

    /**
     * Check individual eShip Plus shipment status
     */
    async checkEShipPlusStatus(shipment) {
        try {
            // Get carrier credentials
            const carrier = await this.getCarrierCredentials('ESHIPPLUS');
            if (!carrier || !carrier.endpoints?.status) {
                console.log('eShip Plus status endpoint not configured');
                return;
            }

            const trackingNumber = shipment.confirmationNumber || shipment.trackingNumber || shipment.proNumber;
            if (!trackingNumber) {
                console.log(`No tracking number for shipment ${shipment.id}`);
                return;
            }

            // Prepare status request
            const statusRequest = {
                trackingNumber: trackingNumber,
                shipmentId: shipment.id,
                carrier: 'ESHIPPLUS'
            };

            // Call Firebase function for status check
            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/checkShipmentStatus', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(statusRequest)
            });

            if (response.ok) {
                const statusData = await response.json();
                await this.updateShipmentStatus(shipment.id, statusData);
            } else {
                console.error(`Status check failed for shipment ${shipment.id}`);
            }

        } catch (error) {
            console.error(`Error checking eShip Plus status for ${shipment.id}:`, error);
        }
    }

    /**
     * Placeholder for Canpar status checking
     */
    async checkCanparStatuses(shipments) {
        console.log('Canpar status checking - placeholder implementation');
        // TODO: Implement Canpar-specific status checking logic
    }

    /**
     * Placeholder for FedEx status checking
     */
    async checkFedExStatuses(shipments) {
        console.log('FedEx status checking - placeholder implementation');
        // TODO: Implement FedEx-specific status checking logic
    }

    /**
     * Placeholder for UPS status checking
     */
    async checkUPSStatuses(shipments) {
        console.log('UPS status checking - placeholder implementation');
        // TODO: Implement UPS-specific status checking logic
    }

    /**
     * Get carrier credentials from database
     */
    async getCarrierCredentials(carrierKey) {
        try {
            const carriersRef = collection(db, 'carriers');
            const q = query(carriersRef, where('carrierKey', '==', carrierKey));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                return snapshot.docs[0].data();
            }
            return null;
        } catch (error) {
            console.error(`Error fetching carrier credentials for ${carrierKey}:`, error);
            return null;
        }
    }

    /**
     * Update shipment status in database
     */
    async updateShipmentStatus(shipmentId, statusData) {
        try {
            const normalizedStatus = normalizeShipmentStatus(statusData.status, statusData.carrier);
            
            const updateData = {
                status: normalizedStatus,
                lastStatusCheck: new Date(),
                statusHistory: statusData.statusHistory || [],
                trackingUpdates: statusData.trackingUpdates || []
            };

            // Add delivery information if delivered
            if (normalizedStatus === SHIPMENT_STATUSES.DELIVERED) {
                updateData.deliveredAt = statusData.deliveredAt || new Date();
                updateData.deliveryLocation = statusData.deliveryLocation;
                updateData.signedBy = statusData.signedBy;
            }

            const shipmentRef = doc(db, 'shipments', shipmentId);
            await updateDoc(shipmentRef, updateData);

            console.log(`Updated status for shipment ${shipmentId}: ${STATUS_DISPLAY_NAMES[normalizedStatus]}`);

        } catch (error) {
            console.error(`Error updating shipment status for ${shipmentId}:`, error);
        }
    }

    /**
     * Calculate the next polling interval based on shipment statuses
     */
    calculateNextPollInterval(shipments) {
        let minInterval = POLLING_INTERVALS.PENDING;

        shipments.forEach(shipment => {
            const status = shipment.status;
            let interval;

            if ([SHIPMENT_STATUSES.IN_TRANSIT, SHIPMENT_STATUSES.SCHEDULED].includes(status)) {
                interval = POLLING_INTERVALS.ACTIVE;
            } else if ([SHIPMENT_STATUSES.ON_HOLD].includes(status)) {
                interval = POLLING_INTERVALS.EXCEPTION;
            } else {
                interval = POLLING_INTERVALS.PENDING;
            }

            if (interval < minInterval) {
                minInterval = interval;
            }
        });

        return minInterval;
    }

    /**
     * Schedule the next polling cycle
     */
    scheduleNextPoll(companyId, interval) {
        if (!this.isPolling) return;

        const timeoutId = setTimeout(() => {
            this.pollShipmentStatuses(companyId);
        }, interval);

        this.pollingIntervals.set(companyId, timeoutId);
        
        console.log(`Next status poll scheduled in ${interval / 1000 / 60} minutes`);
    }

    /**
     * Utility function to add delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Manual status check for a specific shipment
     */
    async checkSingleShipmentStatus(shipmentId) {
        try {
            const shipmentRef = doc(db, 'shipments', shipmentId);
            const shipmentDoc = await getDoc(shipmentRef);

            if (!shipmentDoc.exists()) {
                throw new Error('Shipment not found');
            }

            const shipment = { id: shipmentId, ...shipmentDoc.data() };
            const carrier = this.getShipmentCarrier(shipment);

            await this.checkCarrierShipments(carrier, [shipment]);

            return { success: true, message: 'Status check completed' };
        } catch (error) {
            console.error(`Error in manual status check for ${shipmentId}:`, error);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
export const shipmentStatusService = new ShipmentStatusService();

// Export utility functions
export { POLLING_INTERVALS, STATUS_PRIORITIES };