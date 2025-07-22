const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

/**
 * Get all charge types with filtering and sorting
 */
const getChargeTypes = onCall({
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30
}, async (request) => {
    try {
        const { data, auth } = request;
        
        // Authentication check
        if (!auth) {
            throw new Error('Authentication required');
        }

        // Get user role
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const userData = userDoc.data();
        
        if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
            throw new Error('Admin access required');
        }

        const { enabledOnly = false, category = null } = data || {};

        // Build query
        let query = db.collection('chargeTypes');

        // Filter by enabled status
        if (enabledOnly) {
            query = query.where('enabled', '==', true);
        }

        // Filter by category
        if (category) {
            query = query.where('category', '==', category);
        }

        // Order by display order, then by code
        query = query.orderBy('displayOrder', 'asc').orderBy('code', 'asc');

        const snapshot = await query.get();
        const chargeTypes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.info(`Retrieved ${chargeTypes.length} charge types`, {
            userId: auth.uid,
            enabledOnly,
            category
        });

        return {
            success: true,
            chargeTypes,
            total: chargeTypes.length
        };

    } catch (error) {
        logger.error('Error getting charge types:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Create a new charge type
 */
const createChargeType = onCall({
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 30
}, async (request) => {
    try {
        const { data, auth } = request;
        
        // Authentication check
        if (!auth) {
            throw new Error('Authentication required');
        }

        // Get user data
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const userData = userDoc.data();
        
        if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
            throw new Error('Admin access required');
        }

        const { 
            code, 
            label, 
            category, 
            taxable = false, 
            commissionable = false, 
            enabled = true,
            displayOrder = 999 
        } = data;

        // Validation
        if (!code || !label || !category) {
            throw new Error('Code, label, and category are required');
        }

        // Validate code format (uppercase alphanumeric with spaces/dashes)
        const codeRegex = /^[A-Z0-9\s\-]+$/;
        if (!codeRegex.test(code)) {
            throw new Error('Code must be uppercase alphanumeric with spaces or dashes only');
        }

        // Check if code already exists
        const existingDoc = await db.collection('chargeTypes').doc(code).get();
        if (existingDoc.exists) {
            throw new Error(`Charge type with code '${code}' already exists`);
        }

        // Valid categories
        const validCategories = [
            'freight', 'fuel', 'accessorial', 'taxes', 'surcharges', 
            'insurance', 'logistics', 'government', 'miscellaneous'
        ];

        if (!validCategories.includes(category)) {
            throw new Error(`Category must be one of: ${validCategories.join(', ')}`);
        }

        // Create charge type document
        const chargeTypeData = {
            code: code.trim().toUpperCase(),
            label: label.trim(),
            category: category.toLowerCase(),
            taxable: Boolean(taxable),
            commissionable: Boolean(commissionable),
            enabled: Boolean(enabled),
            isCore: false, // New charge types are not core by default
            displayOrder: Number(displayOrder) || 999,
            
            // Metadata
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userData.email || auth.uid,
            createdByUserId: auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userData.email || auth.uid,
            
            // Version tracking
            version: 1
        };

        await db.collection('chargeTypes').doc(code.trim().toUpperCase()).set(chargeTypeData);

        logger.info(`Created charge type: ${code}`, {
            userId: auth.uid,
            userEmail: userData.email,
            chargeType: chargeTypeData
        });

        return {
            success: true,
            chargeType: {
                id: code.trim().toUpperCase(),
                ...chargeTypeData
            },
            message: `Charge type '${code}' created successfully`
        };

    } catch (error) {
        logger.error('Error creating charge type:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Update an existing charge type
 */
const updateChargeType = onCall({
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 30
}, async (request) => {
    try {
        const { data, auth } = request;
        
        // Authentication check
        if (!auth) {
            throw new Error('Authentication required');
        }

        // Get user data
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const userData = userDoc.data();
        
        if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
            throw new Error('Admin access required');
        }

        const { code, updates } = data;

        if (!code) {
            throw new Error('Charge type code is required');
        }

        // Get existing charge type
        const docRef = db.collection('chargeTypes').doc(code);
        const existingDoc = await docRef.get();
        
        if (!existingDoc.exists) {
            throw new Error(`Charge type '${code}' not found`);
        }

        const existingData = existingDoc.data();

        // Prevent updating core charge types' core status
        if (existingData.isCore && updates.hasOwnProperty('isCore') && !updates.isCore) {
            throw new Error('Cannot disable core status for core charge types');
        }

        // Validate category if being updated
        if (updates.category) {
            const validCategories = [
                'freight', 'fuel', 'accessorial', 'taxes', 'surcharges', 
                'insurance', 'logistics', 'government', 'miscellaneous'
            ];

            if (!validCategories.includes(updates.category)) {
                throw new Error(`Category must be one of: ${validCategories.join(', ')}`);
            }
        }

        // Prepare update data
        const updateData = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userData.email || auth.uid,
            version: admin.firestore.FieldValue.increment(1)
        };

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        await docRef.update(updateData);

        // Get updated document
        const updatedDoc = await docRef.get();
        const updatedData = updatedDoc.data();

        logger.info(`Updated charge type: ${code}`, {
            userId: auth.uid,
            userEmail: userData.email,
            updates: updateData
        });

        return {
            success: true,
            chargeType: {
                id: code,
                ...updatedData
            },
            message: `Charge type '${code}' updated successfully`
        };

    } catch (error) {
        logger.error('Error updating charge type:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Delete a charge type
 */
const deleteChargeType = onCall({
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 30
}, async (request) => {
    try {
        const { data, auth } = request;
        
        // Authentication check
        if (!auth) {
            throw new Error('Authentication required');
        }

        // Get user data
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const userData = userDoc.data();
        
        if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
            throw new Error('Admin access required');
        }

        const { code, forceDelete = false } = data;

        if (!code) {
            throw new Error('Charge type code is required');
        }

        // Get existing charge type
        const docRef = db.collection('chargeTypes').doc(code);
        const existingDoc = await docRef.get();
        
        if (!existingDoc.exists) {
            throw new Error(`Charge type '${code}' not found`);
        }

        const existingData = existingDoc.data();

        // Prevent deleting core charge types unless force delete
        if (existingData.isCore && !forceDelete) {
            throw new Error('Cannot delete core charge types. Use force delete if absolutely necessary.');
        }

        // Check for usage in shipments (optional safety check)
        if (!forceDelete) {
            // Sample check - look at recent shipments for usage
            const recentShipments = await db.collection('shipments')
                .where('status', '!=', 'draft')
                .limit(100)
                .get();

            let usageFound = false;
            recentShipments.forEach(doc => {
                const shipment = doc.data();
                
                // Check various charge arrays
                const chargeArrays = [
                    shipment.chargesBreakdown,
                    shipment.actualCharges,
                    shipment.manualRates
                ];

                chargeArrays.forEach(charges => {
                    if (Array.isArray(charges)) {
                        charges.forEach(charge => {
                            if (charge.code === code || charge.chargeCode === code) {
                                usageFound = true;
                            }
                        });
                    }
                });
            });

            if (usageFound) {
                throw new Error(`Charge type '${code}' is in use by existing shipments. Use force delete to override.`);
            }
        }

        // Delete the charge type
        await docRef.delete();

        // Log deletion
        logger.warn(`Deleted charge type: ${code}`, {
            userId: auth.uid,
            userEmail: userData.email,
            forceDelete,
            deletedData: existingData
        });

        return {
            success: true,
            message: `Charge type '${code}' deleted successfully`
        };

    } catch (error) {
        logger.error('Error deleting charge type:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Get charge type statistics and usage information
 */
const getChargeTypeStats = onCall({
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 30
}, async (request) => {
    try {
        const { auth } = request;
        
        // Authentication check
        if (!auth) {
            throw new Error('Authentication required');
        }

        // Get user role
        const userDoc = await db.collection('users').doc(auth.uid).get();
        const userData = userDoc.data();
        
        if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
            throw new Error('Admin access required');
        }

        // Get all charge types
        const chargeTypesSnapshot = await db.collection('chargeTypes').get();
        const chargeTypes = chargeTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calculate statistics
        const stats = {
            total: chargeTypes.length,
            enabled: chargeTypes.filter(ct => ct.enabled).length,
            disabled: chargeTypes.filter(ct => !ct.enabled).length,
            core: chargeTypes.filter(ct => ct.isCore).length,
            custom: chargeTypes.filter(ct => !ct.isCore).length,
            byCategory: {}
        };

        // Group by category
        chargeTypes.forEach(ct => {
            if (!stats.byCategory[ct.category]) {
                stats.byCategory[ct.category] = {
                    total: 0,
                    enabled: 0,
                    core: 0
                };
            }
            stats.byCategory[ct.category].total++;
            if (ct.enabled) stats.byCategory[ct.category].enabled++;
            if (ct.isCore) stats.byCategory[ct.category].core++;
        });

        return {
            success: true,
            stats,
            chargeTypes: chargeTypes.map(ct => ({
                code: ct.code,
                label: ct.label,
                category: ct.category,
                enabled: ct.enabled,
                isCore: ct.isCore
            }))
        };

    } catch (error) {
        logger.error('Error getting charge type stats:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

module.exports = {
    getChargeTypes,
    createChargeType,
    updateChargeType,
    deleteChargeType,
    getChargeTypeStats
}; 