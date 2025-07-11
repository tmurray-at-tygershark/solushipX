/**
 * Dynamic Status Service
 * Handles the new Master Status + Shipment Status system
 * Fetches styling and configuration from database
 */

import { db } from '../firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';

class DynamicStatusService {
    constructor() {
        this.masterStatuses = [];
        this.shipmentStatuses = [];
        this.masterStatusMap = new Map();
        this.shipmentStatusMap = new Map();
        this.initialized = false;
        this.initPromise = null;
    }

    /**
     * Initialize the service by fetching data from database
     */
    async initialize() {
        if (this.initialized) return;
        
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._fetchStatusData();
        await this.initPromise;
        this.initialized = true;
    }

    /**
     * Fetch master statuses and shipment statuses from database
     */
    async _fetchStatusData() {
        try {
            // Fetch master statuses
            const masterStatusQuery = query(
                collection(db, 'masterStatuses'),
                where('enabled', '==', true),
                orderBy('sortOrder'),
                orderBy('displayLabel')
            );
            
            const masterStatusSnapshot = await getDocs(masterStatusQuery);
            this.masterStatuses = [];
            this.masterStatusMap.clear();

            masterStatusSnapshot.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                this.masterStatuses.push(data);
                this.masterStatusMap.set(data.id, data);
                this.masterStatusMap.set(data.label, data); // Also map by label for lookup
            });

            // Fetch shipment statuses
            const shipmentStatusQuery = query(
                collection(db, 'shipmentStatuses'),
                where('enabled', '==', true),
                orderBy('masterStatus'),
                orderBy('statusLabel')
            );
            
            const shipmentStatusSnapshot = await getDocs(shipmentStatusQuery);
            this.shipmentStatuses = [];
            this.shipmentStatusMap.clear();

            shipmentStatusSnapshot.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                this.shipmentStatuses.push(data);
                this.shipmentStatusMap.set(data.id, data);
                this.shipmentStatusMap.set(data.statusCode, data); // Map by status code
                this.shipmentStatusMap.set(data.statusLabel.toLowerCase(), data); // Map by label
            });

            console.log('📊 Dynamic Status Service initialized:', {
                masterStatuses: this.masterStatuses.length,
                shipmentStatuses: this.shipmentStatuses.length
            });

        } catch (error) {
            console.error('❌ Error initializing Dynamic Status Service:', error);
            throw error;
        }
    }

    /**
     * Get master status by ID or label
     */
    getMasterStatus(identifier) {
        if (!this.initialized) {
            console.warn('DynamicStatusService not initialized');
            return null;
        }
        return this.masterStatusMap.get(identifier);
    }

    /**
     * Get shipment status by ID, code, or label
     */
    getShipmentStatus(identifier) {
        if (!this.initialized) {
            console.warn('DynamicStatusService not initialized');
            return null;
        }
        
        // Try direct lookup first
        let status = this.shipmentStatusMap.get(identifier);
        if (status) return status;
        
        // Try lowercase lookup for labels
        if (typeof identifier === 'string') {
            status = this.shipmentStatusMap.get(identifier.toLowerCase());
            if (status) return status;
        }
        
        return null;
    }

    /**
     * Get all master statuses
     */
    getMasterStatuses() {
        return this.masterStatuses;
    }

    /**
     * Get all shipment statuses
     */
    getShipmentStatuses() {
        return this.shipmentStatuses;
    }

    /**
     * Get shipment statuses for a specific master status
     */
    getShipmentStatusesForMaster(masterStatusId) {
        return this.shipmentStatuses.filter(status => status.masterStatus === masterStatusId);
    }

    /**
     * Get status display configuration for a shipment
     * Returns the master status and optional sub-status
     */
    getStatusDisplay(shipmentStatusIdentifier) {
        const shipmentStatus = this.getShipmentStatus(shipmentStatusIdentifier);
        
        if (!shipmentStatus) {
            // Fallback to legacy status handling
            return this._getLegacyStatusDisplay(shipmentStatusIdentifier);
        }

        const masterStatus = this.getMasterStatus(shipmentStatus.masterStatus);
        
        if (!masterStatus) {
            console.warn('Master status not found for shipment status:', shipmentStatus);
            return null;
        }

        return {
            masterStatus: {
                id: masterStatus.id,
                label: masterStatus.label,
                displayLabel: masterStatus.displayLabel,
                description: masterStatus.description,
                color: masterStatus.color,
                fontColor: masterStatus.fontColor,
                sortOrder: masterStatus.sortOrder
            },
            subStatus: {
                id: shipmentStatus.id,
                statusCode: shipmentStatus.statusCode,
                statusLabel: shipmentStatus.statusLabel,
                statusMeaning: shipmentStatus.statusMeaning
            }
        };
    }

    /**
     * Determine display mode based on status configuration
     * Returns 'master' for primary statuses, 'both' for detailed statuses
     */
    getDisplayMode(shipmentStatusIdentifier) {
        const shipmentStatus = this.getShipmentStatus(shipmentStatusIdentifier);
        
        if (!shipmentStatus) {
            return 'master'; // Default to master for legacy statuses
        }

        const masterStatus = this.getMasterStatus(shipmentStatus.masterStatus);
        
        // If the shipment status label is very similar to master status label,
        // show only master status
        if (masterStatus && this._isStatusSimilar(shipmentStatus.statusLabel, masterStatus.displayLabel)) {
            return 'master';
        }

        // Otherwise show both master and sub-status
        return 'both';
    }

    /**
     * Check if two status labels are similar enough to show only master
     */
    _isStatusSimilar(statusLabel, masterLabel) {
        const normalize = (str) => str.toLowerCase().replace(/[^a-z]/g, '');
        return normalize(statusLabel) === normalize(masterLabel);
    }

    /**
     * Legacy status display for backward compatibility
     */
    _getLegacyStatusDisplay(statusIdentifier) {
        // Map legacy statuses to closest master status
        const legacyMapping = {
            'pending': 'pending',
            'booked': 'booked',
            'scheduled': 'scheduled',
            'in_transit': 'in_transit',
            'awaiting_shipment': 'scheduled',
            'delivered': 'completed',
            'on_hold': 'on_hold',
            'cancelled': 'cancelled',
            'canceled': 'cancelled',
            'void': 'cancelled'
        };

        const mappedLabel = legacyMapping[statusIdentifier?.toLowerCase()] || 'pending';
        const masterStatus = this.getMasterStatus(mappedLabel);

        if (masterStatus) {
            return {
                masterStatus: {
                    id: masterStatus.id,
                    label: masterStatus.label,
                    displayLabel: masterStatus.displayLabel,
                    description: masterStatus.description,
                    color: masterStatus.color,
                    fontColor: masterStatus.fontColor,
                    sortOrder: masterStatus.sortOrder
                },
                subStatus: null // No sub-status for legacy
            };
        }

        // Ultimate fallback
        return {
            masterStatus: {
                id: 'unknown',
                label: 'unknown',
                displayLabel: 'Unknown',
                description: 'Unknown status',
                color: '#6b7280',
                fontColor: '#ffffff',
                sortOrder: 999
            },
            subStatus: null
        };
    }

    /**
     * Get status styling for UI components
     */
    getStatusStyling(shipmentStatusIdentifier) {
        const statusDisplay = this.getStatusDisplay(shipmentStatusIdentifier);
        
        if (!statusDisplay) {
            return {
                backgroundColor: '#6b7280',
                color: '#ffffff',
                borderColor: '#6b7280'
            };
        }

        const { masterStatus } = statusDisplay;
        
        return {
            backgroundColor: masterStatus.color,
            color: masterStatus.fontColor,
            borderColor: masterStatus.color,
            // Additional styling variations
            lightBackground: masterStatus.color + '20', // 20% opacity
            darkBackground: this._darkenColor(masterStatus.color, 10),
            lightBorder: masterStatus.color + '40' // 40% opacity
        };
    }

    /**
     * Darken a hex color by a percentage
     */
    _darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    /**
     * Force refresh data from database
     */
    async refresh() {
        this.initialized = false;
        this.initPromise = null;
        await this.initialize();
    }
}

// Export singleton instance
export const dynamicStatusService = new DynamicStatusService();
export default dynamicStatusService; 