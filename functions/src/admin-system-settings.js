const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

/**
 * Get system settings
 */
const getSystemSettings = onCall(async (request) => {
    try {
        // Check authentication
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        // Check if user is admin or super admin
        const userDoc = await db.collection('users').doc(request.auth.uid).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        if (userRole !== 'admin' && userRole !== 'superadmin') {
            throw new Error('Admin access required');
        }

        // Get system settings document
        const settingsDoc = await db.collection('systemSettings').doc('global').get();
        
        let settings = {
            notificationsEnabled: true,
            maintenanceMode: false,
            systemMessage: '',
            lastUpdated: null,
            lastUpdatedBy: null
        };

        if (settingsDoc.exists) {
            settings = { ...settings, ...settingsDoc.data() };
        }

        logger.info('System settings retrieved', {
            userId: request.auth.uid,
            userRole: userRole
        });

        return {
            success: true,
            settings: settings
        };

    } catch (error) {
        logger.error('Error getting system settings:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Update system settings
 */
const updateSystemSettings = onCall(async (request) => {
    try {
        const { settings } = request.data;

        // Check authentication
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        // Check if user is admin or super admin
        const userDoc = await db.collection('users').doc(request.auth.uid).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        if (userRole !== 'admin' && userRole !== 'superadmin') {
            throw new Error('Admin access required');
        }

        // Validate settings
        if (typeof settings !== 'object') {
            throw new Error('Settings must be an object');
        }

        // Prepare update data
        const updateData = {
            ...settings,
            lastUpdated: new Date(),
            lastUpdatedBy: request.auth.uid
        };

        // Update system settings document
        await db.collection('systemSettings').doc('global').set(updateData, { merge: true });

        logger.info('System settings updated', {
            userId: request.auth.uid,
            userRole: userRole,
            updatedSettings: Object.keys(settings),
            notificationsEnabled: settings.notificationsEnabled
        });

        return {
            success: true,
            message: 'System settings updated successfully'
        };

    } catch (error) {
        logger.error('Error updating system settings:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Check if notifications are globally enabled
 * This function can be called by other cloud functions to check notification status
 */
const areNotificationsEnabled = async () => {
    try {
        const settingsDoc = await db.collection('systemSettings').doc('global').get();
        
        if (!settingsDoc.exists) {
            // Default to enabled if no settings exist
            return true;
        }

        const settings = settingsDoc.data();
        return settings.notificationsEnabled !== false; // Default to true if undefined
        
    } catch (error) {
        logger.error('Error checking notification status:', error);
        // Default to enabled on error to prevent complete notification failure
        return true;
    }
};

module.exports = {
    getSystemSettings,
    updateSystemSettings,
    areNotificationsEnabled
}; 