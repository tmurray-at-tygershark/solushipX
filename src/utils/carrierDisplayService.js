/**
 * Carrier Display Service
 * 
 * Provides white-labeling functionality for carrier names.
 * Companies can override carrier names for customer-facing displays
 * while admins always see the real carrier names.
 */

/**
 * Get the display name for a carrier based on company overrides
 * 
 * @param {Object} carrierInfo - Carrier information (name, carrierID, etc.)
 * @param {string} companyId - Company ID to check for overrides
 * @param {Object} companyData - Company data with connectedCarriers
 * @param {boolean} isAdminView - Whether this is an admin view (always shows real names)
 * @returns {string} - Display name for the carrier
 */
export const getDisplayCarrierName = (carrierInfo, companyId, companyData = null, isAdminView = false) => {
    // Admin users always see real carrier names
    if (isAdminView) {
        return getCarrierRealName(carrierInfo);
    }

    // If no company data provided, return real name
    if (!companyData || !companyId) {
        return getCarrierRealName(carrierInfo);
    }

    // Get carrier ID from various possible sources
    const carrierId = getCarrierId(carrierInfo);
    if (!carrierId) {
        return getCarrierRealName(carrierInfo);
    }

    // Check for company-specific carrier override
    const connectedCarriers = companyData.connectedCarriers || [];
    const carrierOverride = connectedCarriers.find(cc => 
        cc.carrierID === carrierId || 
        cc.carrierName === getCarrierRealName(carrierInfo)
    );

    // Return override display name if exists, otherwise return real name
    if (carrierOverride && carrierOverride.displayName && carrierOverride.displayName.trim()) {
        return carrierOverride.displayName.trim();
    }

    return getCarrierRealName(carrierInfo);
};

/**
 * Get the real carrier name from various carrier info formats
 * 
 * @param {Object|string} carrierInfo - Carrier information
 * @returns {string} - Real carrier name
 */
export const getCarrierRealName = (carrierInfo) => {
    if (typeof carrierInfo === 'string') {
        return carrierInfo;
    }

    if (!carrierInfo) {
        return 'Unknown Carrier';
    }

    // Check various possible name fields
    return carrierInfo.name || 
           carrierInfo.carrierName || 
           carrierInfo.displayName || 
           carrierInfo.label || 
           carrierInfo.carrierID || 
           'Unknown Carrier';
};

/**
 * Get carrier ID from various carrier info formats
 * 
 * @param {Object|string} carrierInfo - Carrier information
 * @returns {string} - Carrier ID
 */
export const getCarrierId = (carrierInfo) => {
    if (typeof carrierInfo === 'string') {
        return carrierInfo;
    }

    if (!carrierInfo) {
        return null;
    }

    return carrierInfo.carrierID || 
           carrierInfo.id || 
           carrierInfo.key || 
           carrierInfo.code ||
           null;
};

/**
 * Check if a carrier has a display name override for a company
 * 
 * @param {string} carrierId - Carrier ID
 * @param {Object} companyData - Company data
 * @returns {boolean} - Whether carrier has override
 */
export const hasCarrierOverride = (carrierId, companyData) => {
    if (!companyData || !carrierId) {
        return false;
    }

    const connectedCarriers = companyData.connectedCarriers || [];
    const carrierOverride = connectedCarriers.find(cc => cc.carrierID === carrierId);
    
    return carrierOverride && carrierOverride.displayName && carrierOverride.displayName.trim();
};

/**
 * Get carrier display info with both real and display names
 * 
 * @param {Object} carrierInfo - Carrier information
 * @param {string} companyId - Company ID
 * @param {Object} companyData - Company data
 * @param {boolean} isAdminView - Whether this is an admin view
 * @returns {Object} - Object with realName, displayName, hasOverride
 */
export const getCarrierDisplayInfo = (carrierInfo, companyId, companyData = null, isAdminView = false) => {
    const realName = getCarrierRealName(carrierInfo);
    const displayName = getDisplayCarrierName(carrierInfo, companyId, companyData, isAdminView);
    const carrierId = getCarrierId(carrierInfo);
    const hasOverride = hasCarrierOverride(carrierId, companyData);

    return {
        realName,
        displayName,
        hasOverride,
        carrierId
    };
};

export default {
    getDisplayCarrierName,
    getCarrierRealName,
    getCarrierId,
    hasCarrierOverride,
    getCarrierDisplayInfo
};