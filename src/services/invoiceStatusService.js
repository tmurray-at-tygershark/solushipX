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

            console.log('🔍 Loading invoice statuses from database...');

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
                
                // Debug log each status
                console.log(`📋 Loaded invoice status: ${data.statusCode} -> ${data.statusLabel} (color: ${data.color})`);
            });

            this.lastCacheUpdate = now;
            console.log(`✅ Successfully loaded ${statuses.length} invoice statuses from database`);
            
            return statuses;
        } catch (error) {
            console.error('❌ Error loading invoice statuses:', error);
            
            // Try alternate collection name as fallback
            try {
                console.log('🔄 Trying alternate collection name: billingStatuses...');
                
                const fallbackQuery = query(
                    collection(db, 'billingStatuses'),
                    where('enabled', '==', true),
                    orderBy('statusLabel')
                );
                
                const fallbackSnapshot = await getDocs(fallbackQuery);
                const fallbackStatuses = [];
                
                fallbackSnapshot.forEach(doc => {
                    const data = doc.data();
                    const status = {
                        id: doc.id,
                        ...data
                    };
                    fallbackStatuses.push(status);
                    this.statusCache.set(doc.id, status);
                });
                
                if (fallbackStatuses.length > 0) {
                    console.log(`✅ Loaded ${fallbackStatuses.length} invoice statuses from billingStatuses collection`);
                    this.lastCacheUpdate = Date.now();
                    return fallbackStatuses;
                }
            } catch (fallbackError) {
                console.error('❌ Fallback collection also failed:', fallbackError);
            }
            
            // Return default statuses if both attempts fail
            console.warn('⚠️ Using default hardcoded statuses as final fallback');
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
                id: 'default-ready-to-invoice',
                statusCode: 'ready_to_invoice',
                statusLabel: 'Ready to Invoice',
                statusDescription: 'Shipment is ready to be invoiced',
                color: '#10b981', // Green color as you mentioned
                fontColor: '#ffffff',
                sortOrder: 1,
                enabled: true
            },
            {
                id: 'default-generated',
                statusCode: 'generated',
                statusLabel: 'Generated',
                statusDescription: 'Invoice PDF has been generated',
                color: '#3b82f6',
                fontColor: '#ffffff',
                sortOrder: 2,
                enabled: true
            },
            {
                id: 'default-invoiced',
                statusCode: 'invoiced',
                statusLabel: 'Invoiced',
                statusDescription: 'Invoice has been generated and sent',
                color: '#6366f1',
                fontColor: '#ffffff',
                sortOrder: 3,
                enabled: true
            },
            {
                id: 'default-paid',
                statusCode: 'paid',
                statusLabel: 'Paid',
                statusDescription: 'Invoice has been paid in full',
                color: '#059669',
                fontColor: '#ffffff',
                sortOrder: 4,
                enabled: true
            },
            {
                id: 'default-overdue',
                statusCode: 'overdue',
                statusLabel: 'Overdue',
                statusDescription: 'Invoice payment is overdue',
                color: '#dc2626',
                fontColor: '#ffffff',
                sortOrder: 5,
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