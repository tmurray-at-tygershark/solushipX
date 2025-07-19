const { onCall } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

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
        
        // Allow admin and superadmin roles to manage invoice statuses
        if (userRole !== 'admin' && userRole !== 'superadmin') {
            throw new Error('Insufficient permissions. Admin access required.');
        }
        
        return { role: userRole, userData };
    } catch (error) {
        console.error('Permission validation error:', error);
        throw new Error('Permission validation failed');
    }
};

// Helper function to generate invoice status code
const generateInvoiceStatusCode = (statusLabel) => {
    return statusLabel
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 30); // Limit length
};

// Create Invoice Status
exports.createInvoiceStatus = onCall({
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
        const { statusLabel, statusDescription, color, fontColor, sortOrder, enabled } = data;
        
        if (!statusLabel) {
            throw new Error('Status label is required');
        }
        
        // Check if invoice status already exists
        const existingQuery = await db.collection('invoiceStatuses')
            .where('statusLabel', '==', statusLabel)
            .limit(1)
            .get();
            
        if (!existingQuery.empty) {
            throw new Error('Invoice status with this label already exists');
        }
        
        // Generate status code
        const statusCode = generateInvoiceStatusCode(statusLabel);
        
        // Create invoice status document
        const invoiceStatusData = {
            statusLabel: statusLabel,
            statusCode: statusCode,
            statusDescription: statusDescription || '',
            color: color || '#6b7280', // Default gray color
            fontColor: fontColor || '#ffffff', // Default white font color
            sortOrder: sortOrder || 0,
            enabled: enabled !== false, // Default to enabled unless explicitly disabled
            createdAt: new Date(),
            createdBy: auth.uid,
            updatedAt: new Date(),
            updatedBy: auth.uid
        };
        
        const docRef = await db.collection('invoiceStatuses').add(invoiceStatusData);
        
        console.log('Invoice status created:', {
            id: docRef.id,
            statusLabel: statusLabel,
            statusCode: statusCode,
            createdBy: auth.uid
        });
        
        return {
            success: true,
            invoiceStatusId: docRef.id,
            statusCode: statusCode,
            message: 'Invoice status created successfully'
        };
        
    } catch (error) {
        console.error('Error creating invoice status:', error);
        throw new Error(`Failed to create invoice status: ${error.message}`);
    }
});

// Update Invoice Status
exports.updateInvoiceStatus = onCall({
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
        
        const { invoiceStatusId, updates } = data;
        
        if (!invoiceStatusId) {
            throw new Error('Invoice status ID is required');
        }
        
        // Get existing invoice status
        const invoiceStatusDoc = await db.collection('invoiceStatuses').doc(invoiceStatusId).get();
        if (!invoiceStatusDoc.exists) {
            throw new Error('Invoice status not found');
        }
        
        // If status label is being updated, check for duplicates
        if (updates.statusLabel) {
            const existingQuery = await db.collection('invoiceStatuses')
                .where('statusLabel', '==', updates.statusLabel)
                .where('__name__', '!=', invoiceStatusId)
                .limit(1)
                .get();
                
            if (!existingQuery.empty) {
                throw new Error('Invoice status with this label already exists');
            }
        }
        
        // Prepare update data
        const updateData = {
            ...updates,
            updatedAt: new Date(),
            updatedBy: auth.uid
        };
        
        // Update status code if label is changed
        if (updates.statusLabel) {
            updateData.statusCode = generateInvoiceStatusCode(updates.statusLabel);
        }
        
        await db.collection('invoiceStatuses').doc(invoiceStatusId).update(updateData);
        
        console.log('Invoice status updated:', {
            id: invoiceStatusId,
            updates: Object.keys(updates),
            updatedBy: auth.uid
        });
        
        return {
            success: true,
            message: 'Invoice status updated successfully'
        };
        
    } catch (error) {
        console.error('Error updating invoice status:', error);
        throw new Error(`Failed to update invoice status: ${error.message}`);
    }
});

// Delete Invoice Status
exports.deleteInvoiceStatus = onCall({
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
        
        const { invoiceStatusId } = data;
        
        if (!invoiceStatusId) {
            throw new Error('Invoice status ID is required');
        }
        
        // Get the invoice status to check usage
        const invoiceStatusDoc = await db.collection('invoiceStatuses').doc(invoiceStatusId).get();
        if (!invoiceStatusDoc.exists) {
            throw new Error('Invoice status not found');
        }
        
        const statusData = invoiceStatusDoc.data();
        
        // Check if invoice status is being used by any shipments/charges
        const usageQuery = await db.collection('shipments')
            .where('invoiceStatus', '==', statusData.statusCode)
            .limit(1)
            .get();
            
        if (!usageQuery.empty) {
            throw new Error('Cannot delete invoice status that is being used by shipments');
        }
        
        // Delete invoice status
        await db.collection('invoiceStatuses').doc(invoiceStatusId).delete();
        
        console.log('Invoice status deleted:', {
            id: invoiceStatusId,
            statusLabel: statusData.statusLabel,
            deletedBy: auth.uid
        });
        
        return {
            success: true,
            message: 'Invoice status deleted successfully'
        };
        
    } catch (error) {
        console.error('Error deleting invoice status:', error);
        throw new Error(`Failed to delete invoice status: ${error.message}`);
    }
});

// Get Invoice Statuses
exports.getInvoiceStatuses = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { auth } = request;
        
        if (!auth) {
            throw new Error('Authentication required');
        }
        
        // Allow all authenticated users to fetch invoice statuses for UI display
        // Only restrict editing/creating/deleting to admins
        const invoiceStatusesQuery = await db.collection('invoiceStatuses')
            .where('enabled', '==', true) // Only return enabled statuses for regular users
            .orderBy('sortOrder')
            .orderBy('statusLabel')
            .get();
            
        const invoiceStatuses = [];
        invoiceStatusesQuery.forEach(doc => {
            invoiceStatuses.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return {
            success: true,
            data: invoiceStatuses
        };
        
    } catch (error) {
        console.error('Error fetching invoice statuses:', error);
        throw new Error(`Failed to fetch invoice statuses: ${error.message}`);
    }
});

// Get All Invoice Statuses (for admin)
exports.getAllInvoiceStatuses = onCall({
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
        
        // Get all invoice statuses (including disabled) for admin interface
        const invoiceStatusesQuery = await db.collection('invoiceStatuses')
            .orderBy('sortOrder')
            .get();
            
        const invoiceStatuses = [];
        invoiceStatusesQuery.forEach(doc => {
            invoiceStatuses.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return {
            success: true,
            invoiceStatuses: invoiceStatuses
        };
        
    } catch (error) {
        console.error('Error fetching all invoice statuses:', error);
        throw new Error(`Failed to fetch all invoice statuses: ${error.message}`);
    }
}); 