const { onCall } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();

// Helper function to validate admin permissions
const validateAdminPermissions = async (uid) => {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        const userRole = userData.role;
        
        if (userRole !== 'admin' && userRole !== 'superadmin') {
            throw new Error('Insufficient permissions. Admin access required.');
        }
        
        return { role: userRole, userData };
    } catch (error) {
        console.error('Permission validation error:', error);
        throw new Error('Permission validation failed');
    }
};

// Helper function to generate status code
const generateStatusCode = (label) => {
    // Generate a numeric code based on label
    let code = 0;
    for (let i = 0; i < label.length; i++) {
        code += label.charCodeAt(i);
    }
    // Add timestamp to ensure uniqueness
    code = code + Date.now() % 1000;
    return code;
};

// Create Master Status
exports.createMasterStatus = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth, data } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        // Validate required fields
        const { label, description, color, sortOrder } = data;
        
        if (!label || !description) {
            throw new Error('Label and description are required');
        }
        
        // Check if master status already exists
        const existingQuery = await db.collection('masterStatuses')
            .where('label', '==', label.toLowerCase())
            .limit(1)
            .get();
            
        if (!existingQuery.empty) {
            throw new Error('Master status with this label already exists');
        }
        
        // Create master status document
        const masterStatusData = {
            label: label.toLowerCase(), // Store as lowercase for consistency
            displayLabel: label, // Store original case for display
            description: description,
            color: color || '#6b7280', // Default gray color
            sortOrder: sortOrder || 0,
            enabled: true,
            createdAt: new Date(),
            createdBy: auth.uid,
            updatedAt: new Date(),
            updatedBy: auth.uid
        };
        
        const docRef = await db.collection('masterStatuses').add(masterStatusData);
        
        console.log('Master status created:', {
            id: docRef.id,
            label: label,
            createdBy: auth.uid
        });
        
        return {
            success: true,
            masterStatusId: docRef.id,
            message: 'Master status created successfully'
        };
        
    } catch (error) {
        console.error('Error creating master status:', error);
        throw new Error(`Failed to create master status: ${error.message}`);
    }
});

// Update Master Status
exports.updateMasterStatus = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth, data } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        const { masterStatusId, updates } = data;
        
        if (!masterStatusId) {
            throw new Error('Master status ID is required');
        }
        
        // Get existing master status
        const masterStatusDoc = await db.collection('masterStatuses').doc(masterStatusId).get();
        if (!masterStatusDoc.exists) {
            throw new Error('Master status not found');
        }
        
        // If label is being updated, check for duplicates
        if (updates.label) {
            const existingQuery = await db.collection('masterStatuses')
                .where('label', '==', updates.label.toLowerCase())
                .where('__name__', '!=', masterStatusId)
                .limit(1)
                .get();
                
            if (!existingQuery.empty) {
                throw new Error('Master status with this label already exists');
            }
        }
        
        // Prepare update data
        const updateData = {
            ...updates,
            updatedAt: new Date(),
            updatedBy: auth.uid
        };
        
        // If label is updated, update both label and displayLabel
        if (updates.label) {
            updateData.label = updates.label.toLowerCase();
            updateData.displayLabel = updates.label;
        }
        
        await db.collection('masterStatuses').doc(masterStatusId).update(updateData);
        
        console.log('Master status updated:', {
            id: masterStatusId,
            updates: Object.keys(updates),
            updatedBy: auth.uid
        });
        
        return {
            success: true,
            message: 'Master status updated successfully'
        };
        
    } catch (error) {
        console.error('Error updating master status:', error);
        throw new Error(`Failed to update master status: ${error.message}`);
    }
});

// Delete Master Status
exports.deleteMasterStatus = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth, data } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        const { masterStatusId } = data;
        
        if (!masterStatusId) {
            throw new Error('Master status ID is required');
        }
        
        // Check if master status is being used by any shipment statuses
        const usageQuery = await db.collection('shipmentStatuses')
            .where('masterStatus', '==', masterStatusId)
            .limit(1)
            .get();
            
        if (!usageQuery.empty) {
            throw new Error('Cannot delete master status that is being used by shipment statuses');
        }
        
        // Delete master status
        await db.collection('masterStatuses').doc(masterStatusId).delete();
        
        console.log('Master status deleted:', {
            id: masterStatusId,
            deletedBy: auth.uid
        });
        
        return {
            success: true,
            message: 'Master status deleted successfully'
        };
        
    } catch (error) {
        console.error('Error deleting master status:', error);
        throw new Error(`Failed to delete master status: ${error.message}`);
    }
});

// Get Master Statuses
exports.getMasterStatuses = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        const masterStatusesQuery = await db.collection('masterStatuses')
            .orderBy('sortOrder')
            .orderBy('displayLabel')
            .get();
            
        const masterStatuses = [];
        masterStatusesQuery.forEach(doc => {
            masterStatuses.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return {
            success: true,
            data: masterStatuses
        };
        
    } catch (error) {
        console.error('Error fetching master statuses:', error);
        throw new Error(`Failed to fetch master statuses: ${error.message}`);
    }
});

// Create Shipment Status
exports.createShipmentStatus = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth, data } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        // Validate required fields
        const { masterStatus, statusLabel, statusMeaning, enabled = true } = data;
        
        if (!masterStatus || !statusLabel || !statusMeaning) {
            throw new Error('Master status, status label, and status meaning are required');
        }
        
        // Verify master status exists
        const masterStatusDoc = await db.collection('masterStatuses').doc(masterStatus).get();
        if (!masterStatusDoc.exists) {
            throw new Error('Master status not found');
        }
        
        // Check if status label already exists
        const existingQuery = await db.collection('shipmentStatuses')
            .where('statusLabel', '==', statusLabel)
            .limit(1)
            .get();
            
        if (!existingQuery.empty) {
            throw new Error('Shipment status with this label already exists');
        }
        
        // Generate status code
        const statusCode = generateStatusCode(statusLabel);
        
        // Create shipment status document
        const shipmentStatusData = {
            masterStatus: masterStatus,
            statusCode: statusCode,
            statusLabel: statusLabel,
            statusMeaning: statusMeaning,
            enabled: enabled,
            createdAt: new Date(),
            createdBy: auth.uid,
            updatedAt: new Date(),
            updatedBy: auth.uid
        };
        
        const docRef = await db.collection('shipmentStatuses').add(shipmentStatusData);
        
        console.log('Shipment status created:', {
            id: docRef.id,
            statusLabel: statusLabel,
            statusCode: statusCode,
            createdBy: auth.uid
        });
        
        return {
            success: true,
            shipmentStatusId: docRef.id,
            statusCode: statusCode,
            message: 'Shipment status created successfully'
        };
        
    } catch (error) {
        console.error('Error creating shipment status:', error);
        throw new Error(`Failed to create shipment status: ${error.message}`);
    }
});

// Update Shipment Status
exports.updateShipmentStatus = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth, data } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        const { shipmentStatusId, updates } = data;
        
        if (!shipmentStatusId) {
            throw new Error('Shipment status ID is required');
        }
        
        // Get existing shipment status
        const shipmentStatusDoc = await db.collection('shipmentStatuses').doc(shipmentStatusId).get();
        if (!shipmentStatusDoc.exists) {
            throw new Error('Shipment status not found');
        }
        
        // If status label is being updated, check for duplicates
        if (updates.statusLabel) {
            const existingQuery = await db.collection('shipmentStatuses')
                .where('statusLabel', '==', updates.statusLabel)
                .where('__name__', '!=', shipmentStatusId)
                .limit(1)
                .get();
                
            if (!existingQuery.empty) {
                throw new Error('Shipment status with this label already exists');
            }
        }
        
        // If master status is being updated, verify it exists
        if (updates.masterStatus) {
            const masterStatusDoc = await db.collection('masterStatuses').doc(updates.masterStatus).get();
            if (!masterStatusDoc.exists) {
                throw new Error('Master status not found');
            }
        }
        
        // Prepare update data
        const updateData = {
            ...updates,
            updatedAt: new Date(),
            updatedBy: auth.uid
        };
        
        await db.collection('shipmentStatuses').doc(shipmentStatusId).update(updateData);
        
        console.log('Shipment status updated:', {
            id: shipmentStatusId,
            updates: Object.keys(updates),
            updatedBy: auth.uid
        });
        
        return {
            success: true,
            message: 'Shipment status updated successfully'
        };
        
    } catch (error) {
        console.error('Error updating shipment status:', error);
        throw new Error(`Failed to update shipment status: ${error.message}`);
    }
});

// Delete Shipment Status
exports.deleteShipmentStatus = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth, data } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        const { shipmentStatusId } = data;
        
        if (!shipmentStatusId) {
            throw new Error('Shipment status ID is required');
        }
        
        // Get the shipment status to check usage
        const shipmentStatusDoc = await db.collection('shipmentStatuses').doc(shipmentStatusId).get();
        if (!shipmentStatusDoc.exists) {
            throw new Error('Shipment status not found');
        }
        
        const statusData = shipmentStatusDoc.data();
        
        // Check if shipment status is being used by any shipments
        const usageQuery = await db.collection('shipments')
            .where('status', '==', statusData.statusCode)
            .limit(1)
            .get();
            
        if (!usageQuery.empty) {
            throw new Error('Cannot delete shipment status that is being used by shipments');
        }
        
        // Delete shipment status
        await db.collection('shipmentStatuses').doc(shipmentStatusId).delete();
        
        console.log('Shipment status deleted:', {
            id: shipmentStatusId,
            statusLabel: statusData.statusLabel,
            deletedBy: auth.uid
        });
        
        return {
            success: true,
            message: 'Shipment status deleted successfully'
        };
        
    } catch (error) {
        console.error('Error deleting shipment status:', error);
        throw new Error(`Failed to delete shipment status: ${error.message}`);
    }
});

// Get Shipment Statuses
exports.getShipmentStatuses = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Validate admin permissions
        await validateAdminPermissions(auth.uid);
        
        // Get shipment statuses with master status data
        const shipmentStatusesQuery = await db.collection('shipmentStatuses')
            .orderBy('masterStatus')
            .orderBy('statusLabel')
            .get();
            
        const masterStatusesQuery = await db.collection('masterStatuses').get();
        
        // Create master statuses lookup
        const masterStatusesMap = {};
        masterStatusesQuery.forEach(doc => {
            masterStatusesMap[doc.id] = {
                id: doc.id,
                ...doc.data()
            };
        });
        
        const shipmentStatuses = [];
        shipmentStatusesQuery.forEach(doc => {
            const statusData = doc.data();
            shipmentStatuses.push({
                id: doc.id,
                ...statusData,
                masterStatusData: masterStatusesMap[statusData.masterStatus] || null
            });
        });
        
        return {
            success: true,
            data: shipmentStatuses,
            masterStatuses: Object.values(masterStatusesMap)
        };
        
    } catch (error) {
        console.error('Error fetching shipment statuses:', error);
        throw new Error(`Failed to fetch shipment statuses: ${error.message}`);
    }
}); 