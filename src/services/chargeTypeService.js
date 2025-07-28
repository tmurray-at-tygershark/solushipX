import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Universal Charge Type Classification Service
 * Maps various carrier charge codes to standardized charge types
 */

// Universal Charge Type Categories
export const CHARGE_CATEGORIES = {
    FREIGHT: 'freight',
    FUEL: 'fuel', 
    ACCESSORIAL: 'accessorial',
    TAXES: 'taxes',
    SURCHARGES: 'surcharges',
    INSURANCE: 'insurance',
    LOGISTICS: 'logistics',
    GOVERNMENT: 'government',
    MISCELLANEOUS: 'miscellaneous'
};

// Universal Charge Types Mapping
export const UNIVERSAL_CHARGE_TYPES = {
    // Freight Charges
    FRT: {
        code: 'FRT',
        label: 'Freight',
        description: 'Base freight charges',
        category: CHARGE_CATEGORIES.FREIGHT,
        isCore: true,
        displayOrder: 1
    },
    
    // Fuel Charges
    FUE: {
        code: 'FUE',
        label: 'Fuel Surcharge',
        description: 'Fuel surcharge',
        category: CHARGE_CATEGORIES.FUEL,
        isCore: true,
        displayOrder: 2
    },
    
    // Accessorial Charges
    ACC: {
        code: 'ACC',
        label: 'Accessorial',
        description: 'Accessorial services',
        category: CHARGE_CATEGORIES.ACCESSORIAL,
        isCore: false,
        displayOrder: 3
    },
    
    // Miscellaneous Charges  
    MSC: {
        code: 'MSC',
        label: 'Miscellaneous',
        description: 'Miscellaneous charges',
        category: CHARGE_CATEGORIES.MISCELLANEOUS,
        isCore: false,
        displayOrder: 4
    },
    
    // Logistics Charges
    LOG: {
        code: 'LOG',
        label: 'Logistics',
        description: 'Logistics services',
        category: CHARGE_CATEGORIES.LOGISTICS,
        isCore: false,
        displayOrder: 5
    },
    
    'IC LOG': {
        code: 'IC LOG',
        label: 'IC Logistics',
        description: 'Integrated Carriers logistics services',
        category: CHARGE_CATEGORIES.LOGISTICS,
        isCore: false,
        displayOrder: 6
    },
    
    // Surcharges
    SUR: {
        code: 'SUR',
        label: 'Surcharge',
        description: 'General surcharge',
        category: CHARGE_CATEGORIES.SURCHARGES,
        isCore: false,
        displayOrder: 7
    },
    
    'IC SUR': {
        code: 'IC SUR',
        label: 'IC Surcharge',
        description: 'Integrated Carriers surcharge',
        category: CHARGE_CATEGORIES.SURCHARGES,
        isCore: false,
        displayOrder: 8
    },
    
    // Tax Charges - Federal
    HST: {
        code: 'HST',
        label: 'HST',
        description: 'Harmonized Sales Tax',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 10
    },
    
    GST: {
        code: 'GST',
        label: 'GST',
        description: 'Goods and Services Tax',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 11
    },
    
    QST: {
        code: 'QST',
        label: 'QST',
        description: 'Quebec Sales Tax',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 12
    },
    
    QGST: {
        code: 'QGST',
        label: 'QGST',
        description: 'Quebec GST',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 13
    },
    
    // Provincial HST
    'HST ON': {
        code: 'HST ON',
        label: 'HST Ontario',
        description: 'HST - Ontario',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 14
    },
    
    'HST BC': {
        code: 'HST BC',
        label: 'HST BC',
        description: 'HST - British Columbia',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 15
    },
    
    'HST NB': {
        code: 'HST NB',
        label: 'HST NB',
        description: 'HST - New Brunswick',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 16
    },
    
    'HST NF': {
        code: 'HST NF',
        label: 'HST NL',
        description: 'HST - Newfoundland and Labrador',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 17
    },
    
    'HST NS': {
        code: 'HST NS',
        label: 'HST NS',
        description: 'HST - Nova Scotia',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 18
    },
    
    'HST PE': {
        code: 'HST PE',
        label: 'HST PE',
        description: 'HST - Prince Edward Island',
        category: CHARGE_CATEGORIES.TAXES,
        isCore: false,
        displayOrder: 19
    },
    
    // Government Charges
    GOVT: {
        code: 'GOVT',
        label: 'Government Fee',
        description: 'Government fees',
        category: CHARGE_CATEGORIES.GOVERNMENT,
        isCore: false,
        displayOrder: 20
    },
    
    GOVD: {
        code: 'GOVD',
        label: 'Government Duty',
        description: 'Government duties',
        category: CHARGE_CATEGORIES.GOVERNMENT,
        isCore: false,
        displayOrder: 21
    },
    
    GSTIMP: {
        code: 'GSTIMP',
        label: 'GST Import',
        description: 'GST on imports',
        category: CHARGE_CATEGORIES.GOVERNMENT,
        isCore: false,
        displayOrder: 22
    },
    
    // Insurance/Claims
    CLAIMS: {
        code: 'CLAIMS',
        label: 'Claims',
        description: 'Insurance claims',
        category: CHARGE_CATEGORIES.INSURANCE,
        isCore: false,
        displayOrder: 30
    }
};

/**
 * Charge Type Classification Service Class
 */
class ChargeTypeService {
    constructor() {
        this.chargeTypeCache = new Map();
        this.lastCacheUpdate = 0;
        this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Get charge type information by code
     * @param {string} chargeCode - The charge code (e.g., 'FRT', 'HST ON')
     * @returns {Object|null} - Charge type information or null if not found
     */
    getChargeType(chargeCode) {
        if (!chargeCode) return null;
        
        // Normalize the charge code
        const normalizedCode = chargeCode.toString().toUpperCase().trim();
        
        // Direct lookup
        if (UNIVERSAL_CHARGE_TYPES[normalizedCode]) {
            return UNIVERSAL_CHARGE_TYPES[normalizedCode];
        }
        
        // Fallback: try to match partial codes
        for (const [code, chargeType] of Object.entries(UNIVERSAL_CHARGE_TYPES)) {
            if (normalizedCode.includes(code) || code.includes(normalizedCode)) {
                return chargeType;
            }
        }
        
        // Return generic miscellaneous type for unknown codes
        return {
            code: normalizedCode,
            label: normalizedCode,
            description: `${normalizedCode} charge`,
            category: CHARGE_CATEGORIES.MISCELLANEOUS,
            isCore: false,
            displayOrder: 999
        };
    }

    /**
     * Get charge category information
     * @param {string} category - The charge category
     * @returns {Object} - Category information
     */
    getCategoryInfo(category) {
        const categoryMap = {
            [CHARGE_CATEGORIES.FREIGHT]: {
                label: 'Freight',
                color: '#3b82f6',
                icon: '🚛',
                description: 'Base freight and transportation charges'
            },
            [CHARGE_CATEGORIES.FUEL]: {
                label: 'Fuel',
                color: '#eab308',
                icon: '⛽',
                description: 'Fuel surcharges and related costs'
            },
            [CHARGE_CATEGORIES.ACCESSORIAL]: {
                label: 'Accessorial',
                color: '#8b5cf6',
                icon: '🔧',
                description: 'Additional services and accessorial charges'
            },
            [CHARGE_CATEGORIES.TAXES]: {
                label: 'Taxes',
                color: '#ef4444',
                icon: '💰',
                description: 'Tax charges (HST, GST, QST, etc.)'
            },
            [CHARGE_CATEGORIES.SURCHARGES]: {
                label: 'Surcharges',
                color: '#f97316',
                icon: '📈',
                description: 'Additional surcharges and fees'
            },
            [CHARGE_CATEGORIES.INSURANCE]: {
                label: 'Insurance',
                color: '#06b6d4',
                icon: '🛡️',
                description: 'Insurance and claims related charges'
            },
            [CHARGE_CATEGORIES.LOGISTICS]: {
                label: 'Logistics',
                color: '#10b981',
                icon: '📦',
                description: 'Logistics and handling services'
            },
            [CHARGE_CATEGORIES.GOVERNMENT]: {
                label: 'Government',
                color: '#6366f1',
                icon: '🏛️',
                description: 'Government fees, duties, and regulatory charges'
            },
            [CHARGE_CATEGORIES.MISCELLANEOUS]: {
                label: 'Miscellaneous',
                color: '#6b7280',
                icon: '📋',
                description: 'Other miscellaneous charges'
            }
        };
        
        return categoryMap[category] || categoryMap[CHARGE_CATEGORIES.MISCELLANEOUS];
    }

    /**
     * Classify charges from a shipment
     * @param {Array} charges - Array of charge objects with code, amount, etc.
     * @returns {Array} - Array of charges with type classification added
     */
    classifyCharges(charges) {
        if (!Array.isArray(charges)) return [];
        
        return charges.map(charge => {
            const chargeType = this.getChargeType(charge.code || charge.chargeCode);
            const categoryInfo = this.getCategoryInfo(chargeType.category);
            
            return {
                ...charge,
                chargeType: chargeType,
                categoryInfo: categoryInfo,
                // For backward compatibility
                type: chargeType.label,
                category: chargeType.category
            };
        });
    }

    /**
     * Get all available charge types sorted by display order
     * @returns {Array} - Array of all charge types
     */
    getAllChargeTypes() {
        return Object.values(UNIVERSAL_CHARGE_TYPES)
            .sort((a, b) => a.displayOrder - b.displayOrder);
    }

    /**
     * Get charge types by category
     * @param {string} category - The charge category
     * @returns {Array} - Array of charge types in the category
     */
    getChargeTypesByCategory(category) {
        return Object.values(UNIVERSAL_CHARGE_TYPES)
            .filter(chargeType => chargeType.category === category)
            .sort((a, b) => a.displayOrder - b.displayOrder);
    }

    /**
     * Get core charge types (most commonly used)
     * @returns {Array} - Array of core charge types
     */
    getCoreChargeTypes() {
        return Object.values(UNIVERSAL_CHARGE_TYPES)
            .filter(chargeType => chargeType.isCore)
            .sort((a, b) => a.displayOrder - b.displayOrder);
    }

    /**
     * Search charge types by label or code
     * @param {string} searchTerm - The search term
     * @returns {Array} - Array of matching charge types
     */
    searchChargeTypes(searchTerm) {
        if (!searchTerm) return this.getAllChargeTypes();
        
        const term = searchTerm.toLowerCase();
        return Object.values(UNIVERSAL_CHARGE_TYPES)
            .filter(chargeType => 
                chargeType.code.toLowerCase().includes(term) ||
                chargeType.label.toLowerCase().includes(term) ||
                chargeType.description.toLowerCase().includes(term)
            )
            .sort((a, b) => a.displayOrder - b.displayOrder);
    }

    /**
     * Get category statistics from charge array
     * @param {Array} charges - Array of classified charges
     * @returns {Object} - Statistics by category
     */
    getCategoryStatistics(charges) {
        const stats = {};
        
        charges.forEach(charge => {
            const category = charge.categoryInfo?.label || 'Unknown';
            if (!stats[category]) {
                stats[category] = {
                    count: 0,
                    totalAmount: 0,
                    charges: []
                };
            }
            
            stats[category].count++;
            stats[category].totalAmount += parseFloat(charge.amount || 0);
            stats[category].charges.push(charge);
        });
        
        return stats;
    }
}

// Export singleton instance
const chargeTypeService = new ChargeTypeService();
export default chargeTypeService; 