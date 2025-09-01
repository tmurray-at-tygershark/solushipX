import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

/**
 * Service to manage dynamic shipment statuses from Firebase
 * Loads master statuses and detailed statuses for shipment filtering
 */
class ShipmentStatusService {
    constructor() {
        this.masterStatusCache = new Map();
        this.detailedStatusCache = new Map();
        this.lastMasterCacheUpdate = 0;
        this.lastDetailedCacheUpdate = 0;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        // Clear cache on startup to force fresh load from correct collection
        this.clearCache();
    }

    /**
     * Load master statuses from Firebase masterStatuses collection
     * These are the high-level statuses like "Booked", "In Transit", "Delivered", etc.
     */
    async loadMasterStatuses() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.masterStatusCache.size > 0 && (now - this.lastMasterCacheUpdate) < this.cacheExpiry) {
                return Array.from(this.masterStatusCache.values());
            }

            console.log('🔍 Loading master statuses from Firebase masterStatuses collection...');

            // Load from Firebase
            const statusesQuery = query(
                collection(db, 'masterStatuses'), 
                orderBy('sortOrder'), 
                orderBy('displayLabel')
            );
            
            const snapshot = await getDocs(statusesQuery);

            if (snapshot.empty) {
                console.warn('⚠️ No master statuses found in masterStatuses collection');
                return this.getDefaultMasterStatuses();
            }

            const statuses = [];
            this.masterStatusCache.clear();

            snapshot.forEach(doc => {
                const data = doc.data();
                const status = {
                    id: doc.id,
                    statusCode: data.label || data.statusCode, // Use 'label' field from database
                    displayLabel: data.displayLabel,
                    description: data.description || '',
                    color: data.color || '#6b7280',
                    fontColor: data.fontColor || '#ffffff',
                    sortOrder: data.sortOrder || 0,
                    enabled: data.enabled !== false // Default to true if not specified
                };
                
                // Only include enabled statuses
                if (status.enabled) {
                    statuses.push(status);
                    this.masterStatusCache.set(doc.id, status);
                }
            });

            // Sort by sortOrder, then by displayLabel
            statuses.sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) {
                    return a.sortOrder - b.sortOrder;
                }
                return a.displayLabel.localeCompare(b.displayLabel);
            });

            this.lastMasterCacheUpdate = now;
            console.log(`✅ Loaded ${statuses.length} master statuses from Firebase`);

            return statuses;
        } catch (error) {
            console.error('❌ Error loading master statuses:', error);
            return this.getDefaultMasterStatuses();
        }
    }

    /**
     * Get default master statuses as fallback
     * These match common shipment statuses
     */
    getDefaultMasterStatuses() {
        return [
            { id: 'pending', statusCode: 'pending', displayLabel: 'Pending', description: 'Shipment is being prepared', color: '#f59e0b', fontColor: '#ffffff', sortOrder: 1, enabled: true },
            { id: 'booked', statusCode: 'booked', displayLabel: 'Booked', description: 'Shipment has been booked', color: '#3b82f6', fontColor: '#ffffff', sortOrder: 2, enabled: true },
            { id: 'scheduled', statusCode: 'scheduled', displayLabel: 'Scheduled', description: 'Pickup or delivery has been scheduled', color: '#8b5cf6', fontColor: '#ffffff', sortOrder: 3, enabled: true },
            { id: 'in_transit', statusCode: 'in_transit', displayLabel: 'In Transit', description: 'Shipment is currently being transported', color: '#8b5cf6', fontColor: '#ffffff', sortOrder: 4, enabled: true },
            { id: 'delivered', statusCode: 'delivered', displayLabel: 'Delivered', description: 'Shipment has been delivered successfully', color: '#10b981', fontColor: '#ffffff', sortOrder: 5, enabled: true },
            { id: 'completed', statusCode: 'completed', displayLabel: 'Completed', description: 'Shipment has been completed', color: '#10b981', fontColor: '#ffffff', sortOrder: 6, enabled: true },
            { id: 'exception', statusCode: 'exception', displayLabel: 'Exception', description: 'Shipment has encountered an issue', color: '#f97316', fontColor: '#ffffff', sortOrder: 7, enabled: true },
            { id: 'on_hold', statusCode: 'on_hold', displayLabel: 'On Hold', description: 'Shipment is temporarily stopped', color: '#eab308', fontColor: '#000000', sortOrder: 8, enabled: true },
            { id: 'cancelled', statusCode: 'cancelled', displayLabel: 'Cancelled', description: 'Shipment has been cancelled', color: '#ef4444', fontColor: '#ffffff', sortOrder: 9, enabled: true },
            { id: 'delayed', statusCode: 'delayed', displayLabel: 'Delayed', description: 'Shipment has been delayed', color: '#f59e0b', fontColor: '#ffffff', sortOrder: 10, enabled: true }
        ];
    }

    /**
     * Format master statuses for dropdown usage
     * Converts to format expected by Enhanced Status Filter
     */
    formatMasterStatusesForDropdown(masterStatuses) {
        const formatted = {};
        
        masterStatuses.forEach((status, index) => {
            const id = index + 100; // Start IDs from 100 to avoid conflicts
            formatted[id] = {
                id: id,
                name: status.displayLabel,
                category: 'MASTER',
                group: 'MASTER_STATUS', 
                color: status.color,
                fontColor: status.fontColor,
                description: status.description,
                statusCode: status.statusCode,
                sortOrder: status.sortOrder
            };
        });

        return formatted;
    }

    /**
     * Clear cache to force fresh reload
     */
    clearCache() {
        this.masterStatusCache.clear();
        this.detailedStatusCache.clear();
        this.lastMasterCacheUpdate = 0;
        this.lastDetailedCacheUpdate = 0;
    }

    /**
     * Get status groups for master statuses
     */
    getMasterStatusGroups() {
        return {
            MASTER_STATUS: {
                name: 'Shipment Status',
                description: 'Master shipment statuses',
                color: '#6b7280',
                order: 1
            }
        };
    }
}

// Export singleton instance
const shipmentStatusService = new ShipmentStatusService();
export default shipmentStatusService;