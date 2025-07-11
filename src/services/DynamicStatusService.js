/**
 * Dynamic Status Service
 * Handles the new Master Status + Shipment Status system
 * Fetches styling and configuration from database
 */

import { db } from '../firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
<<<<<<< HEAD
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
=======
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df

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
<<<<<<< HEAD
        if (this.initialized) {
            console.log('[DynamicStatusService] Already initialized, skipping');
            return;
        }
        
        if (this.initPromise) {
            console.log('[DynamicStatusService] Initialization in progress, waiting...');
            return this.initPromise;
        }

        console.log('[DynamicStatusService] Starting initialization...');

        this.initPromise = this._doInitialize();
        
        try {
            await this.initPromise;
            this.initialized = true;
            console.log('[DynamicStatusService] Initialization completed successfully');
            console.log(`[DynamicStatusService] Loaded ${this.masterStatuses.length} master statuses and ${this.shipmentStatuses.length} shipment statuses`);
        } catch (error) {
            console.error('[DynamicStatusService] Initialization failed:', error);
            this.initPromise = null;
            throw error;
        }
    }

    /**
     * Internal initialization method
     */
    async _doInitialize() {
        try {
            console.log('[DynamicStatusService] Fetching master statuses using cloud function...');
            
            // Try cloud functions first (for authenticated access)
            try {
                const getMasterStatusesFunc = httpsCallable(functions, 'getMasterStatuses');
                const result = await getMasterStatusesFunc();
                
                if (result.data?.success && result.data?.data) {
                    this.masterStatuses = result.data.data;
                    this.masterStatusMap.clear();
                    this.masterStatuses.forEach(status => {
                        this.masterStatusMap.set(status.label, status);
                    });
                    
                    console.log('[DynamicStatusService] Master statuses loaded via cloud function:', this.masterStatuses.map(s => ({
                        label: s.label,
                        displayLabel: s.displayLabel,
                        color: s.color,
                        fontColor: s.fontColor
                    })));
                } else {
                    throw new Error('Cloud function returned no data');
                }
            } catch (cloudError) {
                console.warn('[DynamicStatusService] Cloud function failed, trying direct Firestore access:', cloudError);
                
                // Fallback to direct Firestore access
                const masterStatusQuery = query(
                    collection(db, 'masterStatuses'),
                    orderBy('sortOrder', 'asc')
                );
                const masterStatusSnapshot = await getDocs(masterStatusQuery);
                
                this.masterStatuses = [];
                this.masterStatusMap.clear();
                masterStatusSnapshot.forEach(doc => {
                    const data = { id: doc.id, ...doc.data() };
                    this.masterStatuses.push(data);
                    this.masterStatusMap.set(data.label, data);
                });
                
                console.log('[DynamicStatusService] Master statuses loaded via direct access:', this.masterStatuses.map(s => ({
                    label: s.label,
                    displayLabel: s.displayLabel,
                    color: s.color,
                    fontColor: s.fontColor
                })));
            }

            // Load shipment statuses 
            console.log('[DynamicStatusService] Fetching shipment statuses...');
            try {
                const getShipmentStatusesFunc = httpsCallable(functions, 'getShipmentStatuses');
                const result = await getShipmentStatusesFunc();
                
                if (result.data?.success && result.data?.data) {
                    this.shipmentStatuses = result.data.data;
                    this.shipmentStatusMap.clear();
                    this.shipmentStatuses.forEach(status => {
                        this.shipmentStatusMap.set(status.statusLabel, status);
                    });
                    
                    console.log('[DynamicStatusService] Shipment statuses loaded via cloud function:', this.shipmentStatuses.length);
                } else {
                    throw new Error('Cloud function returned no data');
                }
            } catch (cloudError) {
                console.warn('[DynamicStatusService] Cloud function failed, trying direct Firestore access:', cloudError);
                
                // Fallback to direct Firestore access
                const shipmentStatusQuery = query(
                    collection(db, 'shipmentStatuses'),
                    orderBy('masterStatus', 'asc')
                );
                const shipmentStatusSnapshot = await getDocs(shipmentStatusQuery);
                
                this.shipmentStatuses = [];
                this.shipmentStatusMap.clear();
                shipmentStatusSnapshot.forEach(doc => {
                    const data = { id: doc.id, ...doc.data() };
                    this.shipmentStatuses.push(data);
                    this.shipmentStatusMap.set(data.statusLabel, data);
                });
                
                console.log('[DynamicStatusService] Shipment statuses loaded via direct access:', this.shipmentStatuses.length);
            }

        } catch (error) {
            console.error('[DynamicStatusService] Error during initialization:', error);
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
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
<<<<<<< HEAD
     * Get status display configuration for a given status
     * Handles both new dynamic statuses and legacy status mapping
     */
    getStatusDisplay(statusIdentifier) {
        if (!statusIdentifier) {
            console.warn('getStatusDisplay called with empty statusIdentifier');
            return this.getUnknownStatusDisplay();
        }

        console.log(`Processing status: "${statusIdentifier}" (type: ${typeof statusIdentifier})`);

        // Try to find in dynamic system first
        const dynamicResult = this.findDynamicStatus(statusIdentifier);
        if (dynamicResult) {
            console.log(`Found in dynamic system:`, dynamicResult.masterStatus.displayLabel);
            return dynamicResult;
        }

        // Fall back to legacy status mapping
        console.log(`Not found in dynamic system, trying legacy mapping for: "${statusIdentifier}"`);
        const legacyResult = this.mapLegacyStatus(statusIdentifier);
        if (legacyResult) {
            console.log(`Successfully mapped legacy status "${statusIdentifier}" to "${legacyResult.masterStatus.displayLabel}"`);
            return legacyResult;
        }

        // Ultimate fallback
        console.warn(`No mapping found for status: "${statusIdentifier}", using unknown status display`);
        return this.getUnknownStatusDisplay();
    }

    /**
     * Find status in the dynamic system
     */
    findDynamicStatus(statusIdentifier) {
        // Check if it's a shipment status label
        const shipmentStatus = this.shipmentStatuses.find(status => 
            status.statusLabel === statusIdentifier || 
            status.statusValue === statusIdentifier ||
            status.label === statusIdentifier
        );

        if (shipmentStatus) {
            const masterStatus = this.masterStatusMap.get(shipmentStatus.masterStatus);
            if (masterStatus) {
                return {
                    masterStatus,
                    subStatus: shipmentStatus
                };
            }
        }

        // Check if it's a master status label
        const masterStatus = this.masterStatuses.find(status => 
            status.label === statusIdentifier || 
            status.displayLabel === statusIdentifier
        );

        if (masterStatus) {
            return {
                masterStatus,
                subStatus: null
            };
        }

        return null;
    }

    /**
     * Map legacy status strings to new master status system
     */
    mapLegacyStatus(legacyStatus) {
        if (!legacyStatus || typeof legacyStatus !== 'string') {
            return null;
        }

        const normalizedStatus = legacyStatus.toLowerCase().trim();

        // Legacy to master status mapping - updated to match database configuration
        const legacyMapping = {
            // Draft/Pending statuses → Pending master status
            'draft': 'pending',
            'created': 'pending', 
            'pending': 'pending',
            'awaiting_shipment': 'pending',
            'awaiting shipment': 'pending',
            'label_created': 'pending',
            'preparing': 'pending',
            'ready': 'pending',

            // Booked statuses → Booked master status
            'booked': 'booked',
            'confirmed': 'booked',
            'accepted': 'booked',

            // Scheduled statuses → Scheduled master status
            'scheduled': 'scheduled',
            'pickup_scheduled': 'scheduled',
            'pickup scheduled': 'scheduled',

            // In Transit statuses → In Transit master status
            'in_transit': 'in_transit',
            'in transit': 'in_transit',
            'shipped': 'in_transit',
            'picked_up': 'in_transit',
            'picked up': 'in_transit',
            'out_for_delivery': 'in_transit',
            'out for delivery': 'in_transit',
            'in_delivery': 'in_transit',
            'in delivery': 'in_transit',
            'transit': 'in_transit',

            // Completed statuses → Completed master status
            'completed': 'completed',
            'finished': 'completed',

            // Delivered statuses → Delivered master status (separate from completed)
            'delivered': 'delivered',
            'delivery_completed': 'delivered',
            'delivery completed': 'delivered',

            // Exception statuses → Exception master status
            'exception': 'exception',
            'delayed': 'exception',
            'problem': 'exception',
            'issue': 'exception',
            'failed': 'exception',
            'error': 'exception',

            // On Hold statuses → On Hold master status
            'on_hold': 'on_hold',
            'on hold': 'on_hold',
            'hold': 'on_hold',
            'paused': 'on_hold',
            'suspended': 'on_hold',

            // Cancelled statuses → Cancelled master status
            'cancelled': 'cancelled',
            'canceled': 'cancelled',
            'void': 'cancelled',
            'voided': 'cancelled',
            'terminated': 'cancelled',
            'aborted': 'cancelled'
        };

        const mappedMasterLabel = legacyMapping[normalizedStatus];
        if (!mappedMasterLabel) {
            console.warn(`No mapping found for legacy status: ${legacyStatus}`);
            return null;
        }

        // Find the master status in the database
        const masterStatus = this.masterStatuses.find(status => 
            status.label === mappedMasterLabel
        );

        if (masterStatus) {
            console.log(`Mapped legacy status "${legacyStatus}" to master status "${masterStatus.displayLabel}"`);
            return {
                masterStatus,
                subStatus: null // Legacy statuses map to master only
            };
        }

        console.warn(`Master status not found in database for mapped label: ${mappedMasterLabel}`);
        return null;
    }

    /**
     * Get unknown status display
     */
    getUnknownStatusDisplay() {
        return {
            masterStatus: {
                label: 'unknown',
                displayLabel: 'Unknown',
                description: 'Status not recognized',
                color: '#6b7280',
                fontColor: '#ffffff',
                enabled: true,
                sortOrder: 999
            },
            subStatus: null
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
        };
    }

    /**
<<<<<<< HEAD
     * Determine the appropriate display mode for a status
     */
    getDisplayMode(statusIdentifier) {
        const statusDisplay = this.getStatusDisplay(statusIdentifier);
        
        if (!statusDisplay || !statusDisplay.subStatus) {
            return 'master';
        }
        
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
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
<<<<<<< HEAD
=======
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
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
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