/**
 * Service Level Utilities
 * Utilities for managing company-specific service level restrictions
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Get available service levels for a company based on their restrictions
 * @param {string} companyId - The company ID to check restrictions for
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @param {Object} companyData - Optional company data object to avoid additional DB queries
 * @returns {Promise<Array>} Array of available service level objects
 */
export const getAvailableServiceLevels = async (companyId, serviceType, companyData = null) => {
    try {
        console.log(`[getAvailableServiceLevels] Getting service levels for company: ${companyId}, type: ${serviceType}`);
        
        // Load global service levels
        const serviceLevelsRef = collection(db, 'serviceLevels');
        const globalQuery = query(
            serviceLevelsRef, 
            where('enabled', '==', true),
            where('type', '==', serviceType)
        );
        const globalSnapshot = await getDocs(globalQuery);
        const allServiceLevels = globalSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`[getAvailableServiceLevels] Found ${allServiceLevels.length} global ${serviceType} service levels`);

        // If company data not provided, fetch it
        if (!companyData && companyId) {
            try {
                const companiesRef = collection(db, 'companies');
                const companyQuery = query(companiesRef, where('companyID', '==', companyId));
                const companySnapshot = await getDocs(companyQuery);
                
                if (!companySnapshot.empty) {
                    companyData = companySnapshot.docs[0].data();
                }
            } catch (error) {
                console.warn(`[getAvailableServiceLevels] Could not fetch company data for ${companyId}:`, error);
            }
        }

        // Check if company has service level restrictions
        const restrictions = companyData?.availableServiceLevels;
        
        console.log(`[getAvailableServiceLevels] Company data for ${companyId}:`, companyData);
        console.log(`[getAvailableServiceLevels] Available service levels restrictions:`, restrictions);
        
        if (!restrictions || !restrictions.enabled) {
            // No restrictions - return all service levels
            console.log(`[getAvailableServiceLevels] No restrictions for company ${companyId}, returning all ${allServiceLevels.length} service levels`);
            console.log(`[getAvailableServiceLevels] Restrictions object:`, { restrictions, enabled: restrictions?.enabled });
            return allServiceLevels;
        }

        // Apply company restrictions
        const allowedCodes = restrictions[serviceType] || [];
        
        if (allowedCodes.length === 0) {
            // Company has restrictions enabled but no service levels selected for this type
            console.log(`[getAvailableServiceLevels] Company ${companyId} has restrictions but no ${serviceType} service levels allowed`);
            return [];
        }

        // Filter service levels based on allowed codes
        const filteredServiceLevels = allServiceLevels.filter(level => 
            allowedCodes.includes(level.code)
        );

        console.log(`[getAvailableServiceLevels] Company ${companyId} restrictions applied: ${filteredServiceLevels.length}/${allServiceLevels.length} ${serviceType} service levels available`);
        console.log(`[getAvailableServiceLevels] Allowed codes:`, allowedCodes);
        console.log(`[getAvailableServiceLevels] Available service levels:`, filteredServiceLevels.map(l => l.code));

        return filteredServiceLevels;

    } catch (error) {
        console.error('[getAvailableServiceLevels] Error getting available service levels:', error);
        // Return empty array on error to prevent app crashes
        return [];
    }
};

/**
 * Get all global service levels for a specific type
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @returns {Promise<Array>} Array of all global service level objects
 */
export const getAllServiceLevels = async (serviceType) => {
    try {
        const serviceLevelsRef = collection(db, 'serviceLevels');
        const query_ = query(
            serviceLevelsRef, 
            where('enabled', '==', true),
            where('type', '==', serviceType)
        );
        const snapshot = await getDocs(query_);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('[getAllServiceLevels] Error getting service levels:', error);
        return [];
    }
};

/**
 * Check if a company has service level restrictions enabled
 * @param {Object} companyData - The company data object
 * @returns {boolean} True if restrictions are enabled
 */
export const hasServiceLevelRestrictions = (companyData) => {
    return companyData?.availableServiceLevels?.enabled === true;
};

/**
 * Get the count of available service levels for a company
 * @param {Object} companyData - The company data object
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @returns {number} Count of available service levels (or -1 if no restrictions)
 */
export const getAvailableServiceLevelCount = (companyData, serviceType) => {
    if (!hasServiceLevelRestrictions(companyData)) {
        return -1; // No restrictions, all service levels available
    }
    
    const allowedCodes = companyData?.availableServiceLevels?.[serviceType] || [];
    return allowedCodes.length;
};

/**
 * Check if a specific service level is available for a company
 * @param {Object} companyData - The company data object
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @param {string} serviceCode - The service level code to check
 * @returns {boolean} True if the service level is available
 */
export const isServiceLevelAvailable = (companyData, serviceType, serviceCode) => {
    if (!hasServiceLevelRestrictions(companyData)) {
        return true; // No restrictions, all service levels available
    }
    
    const allowedCodes = companyData?.availableServiceLevels?.[serviceType] || [];
    return allowedCodes.includes(serviceCode);
};

export default {
    getAvailableServiceLevels,
    getAllServiceLevels,
    hasServiceLevelRestrictions,
    getAvailableServiceLevelCount,
    isServiceLevelAvailable
};