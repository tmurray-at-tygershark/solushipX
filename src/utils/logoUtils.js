/**
 * Logo Utilities for Multi-Logo Company System
 * 
 * This utility provides helper functions for selecting the appropriate
 * company logo type based on context, background, and usage scenario.
 */

/**
 * Get the appropriate logo URL based on context
 * @param {Object} company - Company object with logos property
 * @param {string} context - Usage context ('dark', 'light', 'circle', 'auto')
 * @param {string} fallbackType - Fallback logo type if requested type is not available
 * @returns {string} Logo URL or empty string if no logo available
 */
export const getCompanyLogo = (company, context = 'auto', fallbackType = 'dark') => {
    if (!company) return '';
    
    // Handle legacy single logo format
    if (!company.logos && company.logoUrl) {
        return company.logoUrl;
    }
    
    if (!company.logos) return '';
    
    const logos = company.logos;
    
    // Auto-detection based on context
    if (context === 'auto') {
        // Default to dark logo for general use
        context = 'dark';
    }
    
    // Return requested logo type if available
    if (logos[context]) {
        return logos[context];
    }
    
    // Fallback priority: dark -> light -> circle -> legacy
    const fallbackPriority = [fallbackType, 'dark', 'light', 'circle'];
    
    for (const logoType of fallbackPriority) {
        if (logos[logoType]) {
            return logos[logoType];
        }
    }
    
    // Final fallback to legacy logoUrl
    return company.logoUrl || '';
};

/**
 * Get logo for dark backgrounds (navigation, headers, dark UI)
 * @param {Object} company - Company object
 * @returns {string} Logo URL
 */
export const getDarkBackgroundLogo = (company) => {
    return getCompanyLogo(company, 'dark', 'light');
};

/**
 * Get logo for light backgrounds (documents, invoices, white backgrounds)
 * @param {Object} company - Company object
 * @returns {string} Logo URL
 */
export const getLightBackgroundLogo = (company) => {
    return getCompanyLogo(company, 'light', 'dark');
};

/**
 * Get circle logo for avatars, favicons, profile pictures
 * @param {Object} company - Company object
 * @returns {string} Logo URL
 */
export const getCircleLogo = (company) => {
    return getCompanyLogo(company, 'circle', 'dark');
};

/**
 * Get logo for specific UI contexts
 * @param {Object} company - Company object
 * @param {string} uiContext - UI context (navigation, avatar, document, card, etc.)
 * @returns {string} Logo URL
 */
export const getLogoForContext = (company, uiContext) => {
    const contextMapping = {
        // Dark background contexts
        'navigation': 'dark',
        'header': 'dark',
        'sidebar': 'dark',
        'footer-dark': 'dark',
        'dark-theme': 'dark',
        
        // Light background contexts
        'document': 'light',
        'invoice': 'light',
        'email': 'light',
        'report': 'light',
        'card': 'light',
        'modal': 'light',
        'form': 'light',
        'table': 'light',
        'footer-light': 'light',
        'light-theme': 'light',
        
        // Circle contexts
        'avatar': 'circle',
        'profile': 'circle',
        'favicon': 'circle',
        'icon': 'circle',
        'badge': 'circle',
        'chip': 'circle',
        
        // Default
        'default': 'dark'
    };
    
    const logoType = contextMapping[uiContext] || 'dark';
    return getCompanyLogo(company, logoType);
};

/**
 * Check if company has specific logo types
 * @param {Object} company - Company object
 * @returns {Object} Availability status for each logo type
 */
export const getLogoAvailability = (company) => {
    if (!company) {
        return { dark: false, light: false, circle: false, legacy: false };
    }
    
    const logos = company.logos || {};
    
    return {
        dark: Boolean(logos.dark),
        light: Boolean(logos.light),
        circle: Boolean(logos.circle),
        legacy: Boolean(company.logoUrl),
        hasAny: Boolean(logos.dark || logos.light || logos.circle || company.logoUrl)
    };
};

/**
 * Get the best available logo with preference order
 * @param {Object} company - Company object
 * @param {Array} preferenceOrder - Array of logo types in preference order
 * @returns {string} Logo URL
 */
export const getBestAvailableLogo = (company, preferenceOrder = ['dark', 'light', 'circle']) => {
    if (!company) return '';
    
    const logos = company.logos || {};
    
    // Try each preference in order
    for (const logoType of preferenceOrder) {
        if (logos[logoType]) {
            return logos[logoType];
        }
    }
    
    // Fallback to legacy logo
    return company.logoUrl || '';
};

/**
 * Logo type information for UI display
 */
export const LOGO_TYPE_INFO = {
    dark: {
        title: 'Dark Background Logo',
        description: 'Used on dark backgrounds, navigation bars, and headers',
        contexts: ['navigation', 'header', 'sidebar', 'dark-theme'],
        backgroundColor: '#1f2937'
    },
    light: {
        title: 'Light Background Logo',
        description: 'Used on light backgrounds, white papers, and invoices',
        contexts: ['document', 'invoice', 'email', 'report', 'card', 'modal'],
        backgroundColor: '#ffffff'
    },
    circle: {
        title: 'Circle Logo',
        description: 'Used for avatars, favicons, and social media profiles',
        contexts: ['avatar', 'profile', 'favicon', 'icon', 'badge'],
        backgroundColor: '#f3f4f6'
    }
};

export default {
    getCompanyLogo,
    getDarkBackgroundLogo,
    getLightBackgroundLogo,
    getCircleLogo,
    getLogoForContext,
    getLogoAvailability,
    getBestAvailableLogo,
    LOGO_TYPE_INFO
};