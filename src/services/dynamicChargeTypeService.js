import { collection, query, where, getDocs, orderBy, doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Import static fallback data for backward compatibility
import chargeTypeService from './chargeTypeService';

/**
 * Dynamic Charge Type Service with Full Backward Compatibility
 * 
 * This service provides a seamless transition from static to dynamic charge types
 * with automatic fallbacks to ensure existing shipments continue to work
 */

class DynamicChargeTypeService {
    constructor() {
        this.chargeTypesCache = null;
        this.lastCacheUpdate = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.isLoading = false;
    }

    /**
     * Get all charge types from database with static fallback
     */
    async getChargeTypes(enabledOnly = true) {
        try {
            // Try to fetch from database first
            const dynamicChargeTypes = await this.fetchChargeTypesFromDatabase(enabledOnly);
            
            if (dynamicChargeTypes && dynamicChargeTypes.length > 0) {
                console.log('✅ Using dynamic charge types from database');
                return dynamicChargeTypes;
            }
            
            // Fallback to static charge types
            console.log('⚠️  Falling back to static charge types');
            return this.getStaticChargeTypesFallback(enabledOnly);
            
        } catch (error) {
            console.error('❌ Error fetching dynamic charge types, using static fallback:', error);
            return this.getStaticChargeTypesFallback(enabledOnly);
        }
    }

    /**
     * Fetch charge types from Firestore database
     */
    async fetchChargeTypesFromDatabase(enabledOnly = true) {
        try {
            // Check cache first
            if (this.chargeTypesCache && this.lastCacheUpdate && 
                (Date.now() - this.lastCacheUpdate) < this.cacheTimeout) {
                return enabledOnly 
                    ? this.chargeTypesCache.filter(ct => ct.enabled)
                    : this.chargeTypesCache;
            }

            // Prevent multiple simultaneous fetches
            if (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
                return this.getChargeTypes(enabledOnly);
            }

            this.isLoading = true;

            let q = query(
                collection(db, 'chargeTypes'),
                orderBy('displayOrder', 'asc')
            );

            if (enabledOnly) {
                q = query(
                    collection(db, 'chargeTypes'),
                    where('enabled', '==', true),
                    orderBy('displayOrder', 'asc')
                );
            }

            const querySnapshot = await getDocs(q);
            const chargeTypes = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Update cache
            this.chargeTypesCache = chargeTypes;
            this.lastCacheUpdate = Date.now();
            this.isLoading = false;

            return chargeTypes;

        } catch (error) {
            this.isLoading = false;
            console.error('Error fetching charge types from database:', error);
            throw error;
        }
    }

    /**
     * Static fallback using existing chargeTypeService
     */
    getStaticChargeTypesFallback(enabledOnly = true) {
        try {
            const staticChargeTypes = Object.values(chargeTypeService.UNIVERSAL_CHARGE_TYPES)
                .map(ct => ({
                    id: ct.code,
                    code: ct.code,
                    label: ct.label,
                    category: ct.category,
                    taxable: this.inferTaxableStatus(ct.category),
                    commissionable: this.inferCommissionableStatus(ct.category, ct.code),
                    enabled: true,
                    isCore: ct.isCore || false,
                    displayOrder: ct.displayOrder || 999,
                    isStatic: true // Flag to indicate fallback data
                }))
                .sort((a, b) => a.displayOrder - b.displayOrder);

            return enabledOnly 
                ? staticChargeTypes.filter(ct => ct.enabled)
                : staticChargeTypes;

        } catch (error) {
            console.error('Error creating static fallback:', error);
            return [];
        }
    }

    /**
     * Get a specific charge type by code with fallback
     */
    async getChargeType(code) {
        if (!code) return this.getUnknownChargeType(code);

        try {
            // Try database first
            const docRef = doc(db, 'chargeTypes', code);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }

            // Fallback to static
            const staticChargeType = chargeTypeService.getChargeType(code);
            if (staticChargeType && staticChargeType.code !== 'UNKNOWN') {
                return {
                    id: staticChargeType.code,
                    code: staticChargeType.code,
                    label: staticChargeType.label,
                    category: staticChargeType.category,
                    taxable: this.inferTaxableStatus(staticChargeType.category),
                    commissionable: this.inferCommissionableStatus(staticChargeType.category, code),
                    enabled: true,
                    isCore: staticChargeType.isCore || false,
                    displayOrder: staticChargeType.displayOrder || 999,
                    isStatic: true
                };
            }

            // Return unknown type
            return this.getUnknownChargeType(code);

        } catch (error) {
            console.error(`Error fetching charge type ${code}:`, error);
            return this.getUnknownChargeType(code);
        }
    }

    /**
     * Get charge types by category
     */
    async getChargeTypesByCategory(category, enabledOnly = true) {
        const allChargeTypes = await this.getChargeTypes(enabledOnly);
        return allChargeTypes.filter(ct => ct.category === category);
    }

    /**
     * Get core charge types (FRT, FUE, etc.)
     */
    async getCoreChargeTypes() {
        const allChargeTypes = await this.getChargeTypes(true);
        return allChargeTypes.filter(ct => ct.isCore);
    }

    /**
     * Create a new charge type
     */
    async createChargeType(chargeTypeData) {
        try {
            const docRef = doc(db, 'chargeTypes', chargeTypeData.code);
            
            const newChargeType = {
                code: chargeTypeData.code,
                label: chargeTypeData.label,
                category: chargeTypeData.category || 'miscellaneous',
                taxable: chargeTypeData.taxable || false,
                commissionable: chargeTypeData.commissionable || false,
                enabled: chargeTypeData.enabled !== false, // Default to true
                isCore: chargeTypeData.isCore || false,
                displayOrder: chargeTypeData.displayOrder || 999,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await setDoc(docRef, newChargeType);
            
            // Clear cache
            this.clearCache();
            
            return { id: chargeTypeData.code, ...newChargeType };

        } catch (error) {
            console.error('Error creating charge type:', error);
            throw error;
        }
    }

    /**
     * Update an existing charge type
     */
    async updateChargeType(code, updates) {
        try {
            const docRef = doc(db, 'chargeTypes', code);
            
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };

            await updateDoc(docRef, updateData);
            
            // Clear cache
            this.clearCache();
            
            return true;

        } catch (error) {
            console.error('Error updating charge type:', error);
            throw error;
        }
    }

    /**
     * Delete a charge type
     */
    async deleteChargeType(code) {
        try {
            const docRef = doc(db, 'chargeTypes', code);
            await deleteDoc(docRef);
            
            // Clear cache
            this.clearCache();
            
            return true;

        } catch (error) {
            console.error('Error deleting charge type:', error);
            throw error;
        }
    }

    /**
     * Clear the cache to force refresh
     */
    clearCache() {
        this.chargeTypesCache = null;
        this.lastCacheUpdate = null;
    }

    /**
     * Get category information with backward compatibility
     */
    getCategoryInfo(category) {
        return chargeTypeService.getCategoryInfo(category);
    }

    /**
     * Get all available categories
     */
    getCategories() {
        return chargeTypeService.getCategories();
    }

    /**
     * Helper: Create unknown charge type fallback
     */
    getUnknownChargeType(code) {
        return {
            id: `unknown_${code}`,
            code: code || 'UNKNOWN',
            label: `Unknown (${code || 'N/A'})`,
            category: 'miscellaneous',
            taxable: false,
            commissionable: false,
            enabled: true,
            isCore: false,
            displayOrder: 9999,
            isUnknown: true
        };
    }

    /**
     * Helper: Infer taxable status based on category
     */
    inferTaxableStatus(category) {
        const nonTaxableCategories = ['taxes', 'fuel'];
        return !nonTaxableCategories.includes(category);
    }

    /**
     * Helper: Infer commissionable status based on category and code
     */
    inferCommissionableStatus(category, code) {
        const nonCommissionableCategories = ['taxes', 'government'];
        const nonCommissionableCodes = ['ADDR']; // Address corrections not commissionable
        
        return !nonCommissionableCategories.includes(category) && 
               !nonCommissionableCodes.includes(code);
    }

    /**
     * Backward compatibility: Map multiple charge codes to categories
     */
    async classifyCharges(chargeCodes = []) {
        if (!Array.isArray(chargeCodes) || chargeCodes.length === 0) {
            return {
                categories: [],
                chargeTypes: [],
                breakdown: {}
            };
        }

        try {
            const chargeTypes = await Promise.all(
                chargeCodes.map(code => this.getChargeType(code))
            );

            const categories = [...new Set(chargeTypes.map(ct => ct.category))];
            const breakdown = {};

            chargeTypes.forEach(ct => {
                if (!breakdown[ct.category]) {
                    breakdown[ct.category] = [];
                }
                breakdown[ct.category].push(ct);
            });

            return {
                categories,
                chargeTypes,
                breakdown
            };

        } catch (error) {
            console.error('Error classifying charges:', error);
            return {
                categories: [],
                chargeTypes: [],
                breakdown: {}
            };
        }
    }

    /**
     * Check if database has charge types (for migration status)
     */
    async hasDynamicChargeTypes() {
        try {
            const snapshot = await getDocs(query(collection(db, 'chargeTypes'), where('enabled', '==', true)));
            return snapshot.size > 0;
        } catch (error) {
            console.error('Error checking for dynamic charge types:', error);
            return false;
        }
    }

    /**
     * Get charge type statistics
     */
    async getChargeTypeStats() {
        try {
            const allChargeTypes = await this.getChargeTypes(false); // Get all, including disabled
            
            const stats = {
                total: allChargeTypes.length,
                enabled: allChargeTypes.filter(ct => ct.enabled).length,
                disabled: allChargeTypes.filter(ct => !ct.enabled).length,
                core: allChargeTypes.filter(ct => ct.isCore).length,
                byCategory: {},
                isDynamic: !allChargeTypes.some(ct => ct.isStatic)
            };

            // Group by category
            allChargeTypes.forEach(ct => {
                if (!stats.byCategory[ct.category]) {
                    stats.byCategory[ct.category] = 0;
                }
                stats.byCategory[ct.category]++;
            });

            return stats;

        } catch (error) {
            console.error('Error getting charge type stats:', error);
            return {
                total: 0,
                enabled: 0,
                disabled: 0,
                core: 0,
                byCategory: {},
                isDynamic: false
            };
        }
    }
}

// Export singleton instance
const dynamicChargeTypeService = new DynamicChargeTypeService();
export default dynamicChargeTypeService; 