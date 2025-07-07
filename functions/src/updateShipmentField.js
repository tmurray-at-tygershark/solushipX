const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();

/**
 * Cloud Function to update specific shipment fields
 * Updates shipment fields with proper validation and audit logging
 */
exports.updateShipmentField = onCall({
    cors: true,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { 
            shipmentId, 
            fieldPath,
            value,
            reason = 'Field updated',
            validateOnly = false
        } = request.data;

        // Validate input
        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'Shipment ID is required');
        }

        if (!fieldPath) {
            throw new HttpsError('invalid-argument', 'Field path is required');
        }

        // Verify user authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const uid = request.auth.uid;
        console.log(`🔧 Updating field ${fieldPath} for shipment ${shipmentId} by user ${uid}`);

        // Check if user has access to this shipment
        const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
        if (!shipmentDoc.exists) {
            throw new HttpsError('not-found', 'Shipment not found');
        }

        const shipmentData = shipmentDoc.data();

        // Get user data to check permissions
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new HttpsError('permission-denied', 'User not found');
        }

        const userData = userDoc.data();
        const userRole = userData.role;
        const userCompanyId = userData.companyId;

        // Check access permissions
        const isAdmin = userRole === 'admin' || userRole === 'superadmin';
        const isOwner = shipmentData.companyId === userCompanyId;

        if (!isAdmin && !isOwner) {
            throw new HttpsError('permission-denied', 'Access denied to this shipment');
        }

        // Define allowed fields that can be updated
        const allowedFields = [
            'status',
            'trackingNumber',
            'carrierTrackingNumber',
            'shipmentInfo.specialInstructions',
            'shipmentInfo.notes',
            'shipmentInfo.customerReference',
            'shipmentInfo.internalReference',
            'shipmentInfo.deliveryInstructions',
            'shipmentInfo.pickupInstructions',
            'shipmentInfo.saturdayDelivery',
            'shipmentInfo.signatureRequired',
            'shipmentInfo.holdForPickup',
            'shipmentInfo.dangerousGoods',
            'shipmentInfo.internationalShipment',
            'carrierBookingConfirmation.estimatedDeliveryDate',
            'carrierBookingConfirmation.estimatedPickupDate',
            'carrierBookingConfirmation.trackingNumber',
            'carrierBookingConfirmation.confirmationNumber',
            'carrierBookingConfirmation.proNumber'
        ];

        // Admin-only fields
        const adminOnlyFields = [
            'companyId',
            'customerId',
            'selectedCarrier',
            'selectedRate',
            'totalCharges',
            'currency',
            'creationMethod'
        ];

        // Check if field is allowed
        const isAllowedField = allowedFields.includes(fieldPath);
        const isAdminOnlyField = adminOnlyFields.includes(fieldPath);

        if (!isAllowedField && !(isAdmin && isAdminOnlyField)) {
            throw new HttpsError('permission-denied', `Field '${fieldPath}' cannot be updated`);
        }

        // Get current value for audit log
        const currentValue = getNestedValue(shipmentData, fieldPath);

        // If validation only, return success without making changes
        if (validateOnly) {
            return {
                success: true,
                valid: true,
                fieldPath: fieldPath,
                currentValue: currentValue,
                message: 'Field update validation passed'
            };
        }

        // Prepare update object
        const updateData = {
            [fieldPath]: value,
            updatedAt: FieldValue.serverTimestamp(),
            lastUpdatedBy: uid
        };

        // Update the shipment
        await db.collection('shipments').doc(shipmentId).update(updateData);

        // Create audit log entry
        const auditEntry = {
            shipmentId: shipmentId,
            action: 'field_updated',
            userId: uid,
            userEmail: userData.email || 'unknown@example.com',
            timestamp: FieldValue.serverTimestamp(),
            fieldPath: fieldPath,
            previousValue: currentValue,
            newValue: value,
            reason: reason,
            metadata: {
                userRole: userRole,
                companyId: userCompanyId,
                isAdminUpdate: isAdmin && isAdminOnlyField
            }
        };

        // Add audit log entry
        await db.collection('shipmentAuditLog').add(auditEntry);

        console.log(`✅ Field ${fieldPath} updated successfully for shipment ${shipmentId}`);

        return {
            success: true,
            fieldPath: fieldPath,
            previousValue: currentValue,
            newValue: value,
            message: 'Field updated successfully'
        };

    } catch (error) {
        console.error('Error updating shipment field:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', 'Failed to update field: ' + error.message);
    }
});

/**
 * Helper function to get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
} 