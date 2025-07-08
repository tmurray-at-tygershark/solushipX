/**
 * SolushipX Semantic Search Engine - Enhanced Version
 * AI-Powered Natural Language Search for Shipments
 * 
 * Features:
 * - Natural language query understanding
 * - Smart date + status combination filtering
 * - Intelligent contextual suggestions
 * - Proper delivery date handling
 */

// SHIPPING TERMINOLOGY DICTIONARY
const SHIPPING_TERMS = {
    // Status aliases - simplified and focused
    status: {
        'delivered': ['delivered', 'completed', 'received'],
        'in_transit': ['in transit', 'transit', 'on the way', 'shipping', 'en route'],
        'pending': ['pending', 'booked', 'scheduled', 'ready'],
        'delayed': ['delayed', 'late', 'overdue'],
        'cancelled': ['cancelled', 'canceled', 'void'],
        'picked_up': ['picked up', 'collected'],
        'out_for_delivery': ['out for delivery', 'delivering']
    },
    
    // Carrier aliases
    carriers: {
        'fedex': ['fedex', 'fed ex'],
        'ups': ['ups', 'united parcel'],
        'dhl': ['dhl'],
        'canpar': ['canpar'],
        'purolator': ['purolator'],
        'eshipplus': ['eshipplus', 'eship plus']
    },
    
    // Time expressions
    temporal: {
        'today': ['today', 'now', 'current day'],
        'yesterday': ['yesterday'],
        'this_week': ['this week', 'current week'],
        'last_week': ['last week', 'previous week'],
        'this_month': ['this month', 'current month'],
        'last_month': ['last month', 'previous month']
    }
};

/**
 * Enhanced Semantic Search Engine
 */
class SemanticSearchEngine {
    constructor() {
        this.lastQuery = null;
        this.lastResults = null;
    }

    /**
     * Main semantic search function
     */
    async search(query, shipments, options = {}) {
        console.log('🧠 Semantic Search Query:', query);
        
        const normalizedQuery = query.toLowerCase().trim();
        
        // Extract key components from query
        const components = this.extractQueryComponents(normalizedQuery);
        console.log('📊 Query Components:', components);
        
        // Filter shipments based on components
        const results = this.filterShipments(shipments, components);
        
        // Generate smart suggestions based on results
        const suggestions = this.generateSmartSuggestions(normalizedQuery, components, results.length, shipments.length);
        
        // Store for context
        this.lastQuery = query;
        this.lastResults = results;
        
        return {
            query: query,
            normalizedQuery: normalizedQuery,
            intent: components.intent,
            entities: components,
            filters: components,
            results: results,
            suggestions: suggestions,
            metadata: {
                totalResults: results.length,
                searchTime: Date.now(),
                confidence: this.calculateConfidence(components, results.length)
            }
        };
    }

    /**
     * Extract components from natural language query
     */
    extractQueryComponents(query) {
        const components = {
            statuses: [],
            timeExpressions: [],
            carriers: [],
            dateRange: null,
            intent: 'FILTER',
            hasDeliveryIntent: false
        };

        // Check for delivery-related keywords
        if (query.includes('delivered') || query.includes('delivery')) {
            components.hasDeliveryIntent = true;
        }

        // Extract status terms
        for (const [status, aliases] of Object.entries(SHIPPING_TERMS.status)) {
            if (aliases.some(alias => query.includes(alias))) {
                components.statuses.push(status);
            }
        }

        // Extract time expressions
        for (const [timeExpr, aliases] of Object.entries(SHIPPING_TERMS.temporal)) {
            if (aliases.some(alias => query.includes(alias))) {
                components.timeExpressions.push(timeExpr);
                components.dateRange = this.parseTimeExpression(timeExpr);
            }
        }

        // Extract carriers
        for (const [carrier, aliases] of Object.entries(SHIPPING_TERMS.carriers)) {
            if (aliases.some(alias => query.includes(alias))) {
                components.carriers.push(carrier);
            }
        }

        return components;
    }

    /**
     * Parse time expressions into date ranges
     */
    parseTimeExpression(timeExpr) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (timeExpr) {
            case 'today':
                return {
                    start: today,
                    end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                    label: 'Today'
                };
            case 'yesterday':
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                return {
                    start: yesterday,
                    end: today,
                    label: 'Yesterday'
                };
            case 'this_week':
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                return {
                    start: startOfWeek,
                    end: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000),
                    label: 'This Week'
                };
            case 'last_week':
                const lastWeekStart = new Date(today);
                lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
                return {
                    start: lastWeekStart,
                    end: new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
                    label: 'Last Week'
                };
            default:
                return null;
        }
    }

    /**
     * Filter shipments based on extracted components
     */
    filterShipments(shipments, components) {
        let filtered = [...shipments];

        // Apply status filter
        if (components.statuses.length > 0) {
            filtered = filtered.filter(shipment => {
                const shipmentStatus = (shipment.status || '').toLowerCase();
                return components.statuses.some(status => {
                    const statusAliases = SHIPPING_TERMS.status[status] || [status];
                    return statusAliases.some(alias => shipmentStatus.includes(alias));
                });
            });
        }

        // Apply date filter with proper field selection
        if (components.dateRange) {
            filtered = filtered.filter(shipment => {
                let dateToCheck;

                // If query mentions "delivered", check delivery date
                if (components.hasDeliveryIntent || components.statuses.includes('delivered')) {
                    dateToCheck = this.getDeliveryDate(shipment);
                } else {
                    // Otherwise check shipment/creation date
                    dateToCheck = this.getShipmentDate(shipment);
                }

                if (!dateToCheck) return false;

                return dateToCheck >= components.dateRange.start && 
                       dateToCheck < components.dateRange.end;
            });
        }

        // Apply carrier filter
        if (components.carriers.length > 0) {
            filtered = filtered.filter(shipment => {
                const carrierFields = [
                    shipment.carrier,
                    shipment.selectedCarrier,
                    shipment.selectedRate?.carrier,
                    shipment.carrierName
                ].filter(Boolean).map(c => c.toLowerCase());

                return components.carriers.some(carrier => {
                    const carrierAliases = SHIPPING_TERMS.carriers[carrier] || [carrier];
                    return carrierFields.some(field =>
                        carrierAliases.some(alias => field.includes(alias))
                    );
                });
            });
        }

        return filtered;
    }

    /**
     * Get delivery date from shipment
     */
    getDeliveryDate(shipment) {
        const deliveryFields = [
            shipment.deliveredAt,
            shipment.actualDeliveryDate,
            shipment.shipmentInfo?.deliveredAt,
            shipment.carrierBookingConfirmation?.deliveredAt,
            shipment.statusUpdates?.find(u => u.status === 'delivered')?.timestamp
        ];

        return this.parseDate(deliveryFields);
    }

    /**
     * Get shipment/creation date
     */
    getShipmentDate(shipment) {
        const dateFields = [
            shipment.shipmentDate,
            shipment.scheduledDate,
            shipment.bookedAt,
            shipment.createdAt
        ];

        return this.parseDate(dateFields);
    }

    /**
     * Parse various date formats
     */
    parseDate(dateFields) {
        for (const field of dateFields) {
            if (field) {
                try {
                    let date;
                    if (field && typeof field.toDate === 'function') {
                        date = field.toDate();
                    } else if (field && field.seconds) {
                        date = new Date(field.seconds * 1000);
                    } else if (field) {
                        date = new Date(field);
                    }
                    
                    if (date && !isNaN(date.getTime())) {
                        return date;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        return null;
    }

    /**
     * Generate smart, contextual suggestions
     */
    generateSmartSuggestions(query, components, resultCount, totalShipments) {
        const suggestions = [];

        // If searching for "delivered today" with no results
        if (components.statuses.includes('delivered') && components.timeExpressions.includes('today') && resultCount === 0) {
            suggestions.push({
                type: 'alternative',
                text: 'No deliveries today. Try "delivered yesterday"',
                query: 'delivered yesterday',
                icon: '📅'
            });
            
            suggestions.push({
                type: 'alternative',
                text: 'Show all delivered shipments',
                query: 'delivered',
                icon: '✅'
            });
        }

        // If few results, suggest broadening
        if (resultCount > 0 && resultCount < 5) {
            if (components.dateRange) {
                suggestions.push({
                    type: 'broaden',
                    text: `Only ${resultCount} results. Remove date filter to see more`,
                    query: components.statuses.join(' '),
                    icon: '📊'
                });
            }
        }

        // If many results, suggest narrowing
        if (resultCount > 20) {
            if (!components.dateRange) {
                suggestions.push({
                    type: 'narrow',
                    text: 'Add "today" to see recent shipments',
                    query: query + ' today',
                    icon: '📅'
                });
            }

            if (!components.statuses.length) {
                suggestions.push({
                    type: 'narrow',
                    text: 'Filter by "delivered" status',
                    query: query + ' delivered',
                    icon: '✅'
                });
            }
        }

        // Always provide useful alternatives
        if (!components.statuses.includes('delayed')) {
            suggestions.push({
                type: 'quick_filter',
                text: 'Show delayed shipments',
                query: 'delayed',
                icon: '⚠️'
            });
        }

        if (!components.statuses.includes('in_transit')) {
            suggestions.push({
                type: 'quick_filter',
                text: 'Show shipments in transit',
                query: 'in transit',
                icon: '🚚'
            });
        }

        return suggestions.slice(0, 3); // Return top 3 most relevant
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(components, resultCount) {
        let confidence = 0.5;

        // Higher confidence for specific queries
        if (components.statuses.length > 0) confidence += 0.2;
        if (components.dateRange) confidence += 0.2;
        if (components.carriers.length > 0) confidence += 0.1;

        // Adjust based on results
        if (resultCount > 0 && resultCount <= 20) confidence += 0.1;
        else if (resultCount === 0) confidence -= 0.2;

        return Math.max(0.1, Math.min(confidence, 1.0));
    }
}

// Export singleton instance
export const semanticSearch = new SemanticSearchEngine();

// Export utility functions
export {
    SHIPPING_TERMS
}; 