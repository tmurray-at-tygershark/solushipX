import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

class InvoiceStatusService {
    constructor() {
        this.statusCache = new Map();
        this.lastCacheUpdate = 0;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Load invoice statuses from Firestore
     */
    async loadInvoiceStatuses() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.statusCache.size > 0 && (now - this.lastCacheUpdate) < this.cacheExpiry) {
                return Array.from(this.statusCache.values());
            }

            console.log('Loading invoice statuses from database...');

            const statusQuery = query(
                collection(db, 'invoiceStatuses'),
                where('enabled', '==', true),
                orderBy('sortOrder'),
                orderBy('statusLabel')
            );

            const snapshot = await getDocs(statusQuery);
            const statuses = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const status = {
                    id: doc.id,
                    ...data
                };
                statuses.push(status);
                this.statusCache.set(doc.id, status);
            });

            this.lastCacheUpdate = now;
            console.log(`Loaded ${statuses.length} invoice statuses`);
            
            return statuses;
        } catch (error) {
            console.error('Error loading invoice statuses:', error);
            // Return default statuses if database fails
            return this.getDefaultStatuses();
        }
    }

    /**
     * Get status by code
     */
    async getStatusByCode(statusCode) {
        const statuses = await this.loadInvoiceStatuses();
        return statuses.find(status => status.statusCode === statusCode);
    }

    /**
     * Get status by label
     */
    async getStatusByLabel(statusLabel) {
        const statuses = await this.loadInvoiceStatuses();
        return statuses.find(status => status.statusLabel === statusLabel);
    }

    /**
     * Get all status options for dropdowns
     */
    async getStatusOptions() {
        const statuses = await this.loadInvoiceStatuses();
        return statuses.map(status => ({
            value: status.statusCode,
            label: status.statusLabel,
            color: status.color,
            fontColor: status.fontColor
        }));
    }

    /**
     * Format status for display (chip styling)
     */
    getStatusChipProps(status) {
        if (!status) {
            return {
                color: '#92400e',
                backgroundColor: '#fef3c7',
                label: 'uninvoiced'
            };
        }

        return {
            color: status.fontColor || '#ffffff',
            backgroundColor: status.color || '#6b7280',
            label: status.statusLabel || status.statusCode || 'unknown'
        };
    }

    /**
     * Default invoice statuses for fallback
     */
    getDefaultStatuses() {
        return [
            {
                id: 'default-uninvoiced',
                statusCode: 'uninvoiced',
                statusLabel: 'Uninvoiced',
                statusDescription: 'Shipment has not been invoiced yet',
                color: '#f59e0b',
                fontColor: '#ffffff',
                sortOrder: 0,
                enabled: true
            },
            {
                id: 'default-invoiced',
                statusCode: 'invoiced',
                statusLabel: 'Invoiced',
                statusDescription: 'Invoice has been generated and sent',
                color: '#3b82f6',
                fontColor: '#ffffff',
                sortOrder: 1,
                enabled: true
            },
            {
                id: 'default-paid',
                statusCode: 'paid',
                statusLabel: 'Paid',
                statusDescription: 'Invoice has been paid in full',
                color: '#10b981',
                fontColor: '#ffffff',
                sortOrder: 2,
                enabled: true
            }
        ];
    }

    /**
     * Clear cache (useful for admin updates)
     */
    clearCache() {
        this.statusCache.clear();
        this.lastCacheUpdate = 0;
    }

    /**
     * Get status mapping for filters and queries
     */
    async getStatusMapping() {
        const statuses = await this.loadInvoiceStatuses();
        const mapping = {
            all: { label: 'All Statuses', codes: [] },
            uninvoiced: { label: 'Uninvoiced', codes: [] },
            invoiced: { label: 'Invoiced', codes: [] },
            paid: { label: 'Paid', codes: [] }
        };

        // Map statuses to categories
        statuses.forEach(status => {
            const code = status.statusCode.toLowerCase();
            const label = status.statusLabel.toLowerCase();

            if (code.includes('uninvoiced') || label.includes('uninvoiced') || code.includes('draft')) {
                mapping.uninvoiced.codes.push(status.statusCode);
            } else if (code.includes('paid') || label.includes('paid') || code.includes('completed')) {
                mapping.paid.codes.push(status.statusCode);
            } else if (code.includes('invoiced') || label.includes('invoiced') || code.includes('billed')) {
                mapping.invoiced.codes.push(status.statusCode);
            }

            // Add to 'all' category
            mapping.all.codes.push(status.statusCode);
        });

        return mapping;
    }
}

// Export singleton instance
const invoiceStatusService = new InvoiceStatusService();
export default invoiceStatusService; 