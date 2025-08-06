/**
 * Service Level Utilities
 * Utilities for managing company-specific service level restrictions
 */

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
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

/**
 * Get available additional services for a carrier based on their restrictions
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @param {Object} carrierData - The carrier data object containing availableAdditionalServices
 * @returns {Promise<Array>} Array of available additional service objects
 */
export const getAvailableAdditionalServices = async (serviceType, carrierData = null) => {
    try {
        console.log(`[getAvailableAdditionalServices] Getting additional services for type: ${serviceType}`);
        
        // Load global additional services
        const servicesRef = collection(db, 'shipmentServices');
        const globalQuery = query(
            servicesRef, 
            where('enabled', '==', true),
            where('type', '==', serviceType)
        );
        const globalSnapshot = await getDocs(globalQuery);
        const allAdditionalServices = globalSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`[getAvailableAdditionalServices] Found ${allAdditionalServices.length} global ${serviceType} additional services`);

        // Check if carrier has additional service restrictions
        const restrictions = carrierData?.availableAdditionalServices;
        
        console.log(`[getAvailableAdditionalServices] Carrier restrictions:`, restrictions);
        
        if (!restrictions || !restrictions.enabled) {
            // No restrictions - return all additional services
            console.log(`[getAvailableAdditionalServices] No restrictions for carrier, returning all ${allAdditionalServices.length} additional services`);
            return allAdditionalServices;
        }

        // Apply carrier restrictions
        const allowedCodes = restrictions[serviceType] || [];
        
        if (allowedCodes.length === 0) {
            // Carrier has restrictions enabled but no additional services selected for this type
            console.log(`[getAvailableAdditionalServices] Carrier has restrictions but no ${serviceType} additional services allowed`);
            return [];
        }

        // Filter additional services based on allowed codes
        const filteredAdditionalServices = allAdditionalServices.filter(service => 
            allowedCodes.includes(service.code)
        );

        console.log(`[getAvailableAdditionalServices] Carrier restrictions applied: ${filteredAdditionalServices.length}/${allAdditionalServices.length} ${serviceType} additional services available`);
        console.log(`[getAvailableAdditionalServices] Allowed codes:`, allowedCodes);
        console.log(`[getAvailableAdditionalServices] Available additional services:`, filteredAdditionalServices.map(s => s.code));

        return filteredAdditionalServices;

    } catch (error) {
        console.error('[getAvailableAdditionalServices] Error getting available additional services:', error);
        // Return empty array on error to prevent app crashes
        return [];
    }
};

/**
 * Get all global additional services for a specific type
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @returns {Promise<Array>} Array of all global additional service objects
 */
export const getAllAdditionalServices = async (serviceType) => {
    try {
        const servicesRef = collection(db, 'shipmentServices');
        const query_ = query(
            servicesRef, 
            where('enabled', '==', true),
            where('type', '==', serviceType)
        );
        const snapshot = await getDocs(query_);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('[getAllAdditionalServices] Error getting additional services:', error);
        return [];
    }
};

/**
 * Check if a carrier has additional service restrictions enabled
 * @param {Object} carrierData - The carrier data object
 * @returns {boolean} True if restrictions are enabled
 */
export const hasAdditionalServiceRestrictions = (carrierData) => {
    return carrierData?.availableAdditionalServices?.enabled === true;
};

/**
 * Get the count of available additional services for a carrier
 * @param {Object} carrierData - The carrier data object
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @returns {number} Count of available additional services (or -1 if no restrictions)
 */
export const getAvailableAdditionalServiceCount = (carrierData, serviceType) => {
    if (!hasAdditionalServiceRestrictions(carrierData)) {
        return -1; // No restrictions, all additional services available
    }
    
    const allowedCodes = carrierData?.availableAdditionalServices?.[serviceType] || [];
    return allowedCodes.length;
};

/**
 * Check if a specific additional service is available for a carrier
 * @param {Object} carrierData - The carrier data object
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @param {string} serviceCode - The additional service code to check
 * @returns {boolean} True if the additional service is available
 */
export const isAdditionalServiceAvailable = (carrierData, serviceType, serviceCode) => {
    if (!hasAdditionalServiceRestrictions(carrierData)) {
        return true; // No restrictions, all additional services available
    }
    
    const allowedCodes = carrierData?.availableAdditionalServices?.[serviceType] || [];
    return allowedCodes.includes(serviceCode);
};

/**
 * Get available additional services for a company with carrier and company-level filtering
 * @param {string} companyId - The company ID
 * @param {string} serviceType - The service type ('freight' or 'courier')
 * @param {Object} companyData - The company data object (optional, will fetch if not provided)
 * @param {Object} carrierData - The carrier data object (optional, for double filtering)
 * @returns {Promise<Array>} Array of available additional service objects with default flags
 */
export const getCompanyAdditionalServices = async (companyId, serviceType, companyData = null, carrierData = null) => {
    try {
        console.log(`[getCompanyAdditionalServices] Getting additional services for company: ${companyId}, type: ${serviceType}`);
        
        // Load global additional services
        const allAdditionalServices = await getAllAdditionalServices(serviceType);
        
        // If no company data provided, try to fetch it
        let effectiveCompanyData = companyData;
        if (!effectiveCompanyData && companyId) {
            try {
                const companyDoc = await getDoc(doc(db, 'companies', companyId));
                if (companyDoc.exists()) {
                    effectiveCompanyData = companyDoc.data();
                }
            } catch (error) {
                console.warn(`[getCompanyAdditionalServices] Could not fetch company data for ${companyId}:`, error);
            }
        }

        // Start with all global services
        let availableServices = [...allAdditionalServices];

        // Apply carrier restrictions first (if provided)
        if (carrierData) {
            availableServices = await getAvailableAdditionalServices(serviceType, carrierData);
        }

        // Apply company restrictions
        const companyRestrictions = effectiveCompanyData?.availableAdditionalServices;
        if (!companyRestrictions || !companyRestrictions.enabled) {
            // No company restrictions - return all available services (after carrier filtering)
            console.log(`[getCompanyAdditionalServices] No company restrictions, returning ${availableServices.length} services`);
            return availableServices.map(service => ({
                ...service,
                defaultEnabled: false // No defaults when restrictions disabled
            }));
        }

        // Apply company restrictions
        const allowedServiceConfigs = companyRestrictions[serviceType] || [];
        
        if (allowedServiceConfigs.length === 0) {
            // Company has restrictions enabled but no additional services selected for this type
            console.log(`[getCompanyAdditionalServices] Company has restrictions but no ${serviceType} additional services allowed`);
            return [];
        }

        // Filter services based on company allowed codes and add default flags
        const filteredServices = availableServices
            .map(service => {
                // Find company config for this service
                const companyConfig = allowedServiceConfigs.find(config => 
                    typeof config === 'string' ? config === service.code : config.code === service.code
                );
                
                if (companyConfig) {
                    return {
                        ...service,
                        defaultEnabled: typeof companyConfig === 'object' ? (companyConfig.defaultEnabled || false) : false
                    };
                }
                return null;
            })
            .filter(Boolean);

        console.log(`[getCompanyAdditionalServices] Company restrictions applied: ${filteredServices.length}/${availableServices.length} ${serviceType} additional services available`);
        console.log(`[getCompanyAdditionalServices] Services with defaults:`, filteredServices.filter(s => s.defaultEnabled).map(s => s.code));

        return filteredServices;

    } catch (error) {
        console.error('[getCompanyAdditionalServices] Error getting company additional services:', error);
        return [];
    }
};

/**
 * Check if a company has additional service restrictions enabled
 * @param {Object} companyData - The company data object
 * @returns {boolean} True if restrictions are enabled
 */
export const hasCompanyAdditionalServiceRestrictions = (companyData) => {
    return companyData?.availableAdditionalServices?.enabled === true;
};

export default {
    getAvailableServiceLevels,
    getAllServiceLevels,
    hasServiceLevelRestrictions,
    getAvailableServiceLevelCount,
    isServiceLevelAvailable,
    getAvailableAdditionalServices,
    getAllAdditionalServices,
    hasAdditionalServiceRestrictions,
    getAvailableAdditionalServiceCount,
    isAdditionalServiceAvailable,
    getCompanyAdditionalServices,
    hasCompanyAdditionalServiceRestrictions
};