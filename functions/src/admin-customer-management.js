const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

// Initialize Firestore
const db = admin.firestore();

/**
 * Admin Delete Customer Function
 * Deletes a customer and all associated data
 * 
 * @param {Object} request - The request object
 * @param {string} request.data.customerId - The ID of the customer to delete
 * @returns {Object} Success or error status
 */
exports.adminDeleteCustomer = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    console.log('adminDeleteCustomer called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('adminDeleteCustomer: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { customerId } = request.data;

    if (!customerId) {
        console.error('adminDeleteCustomer: Missing customerId in data.');
        throw new HttpsError('invalid-argument', 'customerId is required.');
    }

    try {
        // Verify calling user's admin role
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();

        if (!adminUserDoc.exists) {
            console.error(`adminDeleteCustomer: Admin user document ${callingUserUid} not found.`);
            throw new HttpsError('permission-denied', 'Your user profile was not found.');
        }
        
        const adminUserData = adminUserDoc.data();
        const allowedAdminRoles = ["admin", "superadmin"];
        if (!allowedAdminRoles.includes(adminUserData.role)) {
            console.error(`adminDeleteCustomer: User ${callingUserUid} (role: ${adminUserData.role}) does not have admin privileges.`);
            throw new HttpsError('permission-denied', 'You do not have sufficient privileges to perform this action.');
        }

        console.log(`Admin user ${callingUserUid} (role: ${adminUserData.role}) attempting to delete customer ${customerId}`);

        // Get customer document to verify it exists and get data
        let customerDoc = null;
        let customerData = null;
        let customerFirestoreId = null;

        // First try to get by document ID
        try {
            const customerDocRef = db.collection('customers').doc(customerId);
            customerDoc = await customerDocRef.get();
            if (customerDoc.exists) {
                customerData = customerDoc.data();
                customerFirestoreId = customerDoc.id;
            }
        } catch (error) {
            console.log('Customer not found by document ID, trying customerID field');
        }

        // If not found by document ID, try by customerID field
        if (!customerData) {
            const customerQuery = db.collection('customers').where('customerID', '==', customerId);
            const customerSnapshot = await customerQuery.get();
            if (!customerSnapshot.empty) {
                customerDoc = customerSnapshot.docs[0];
                customerData = customerDoc.data();
                customerFirestoreId = customerDoc.id;
            }
        }

        if (!customerData) {
            console.error(`adminDeleteCustomer: Customer ${customerId} not found.`);
            throw new HttpsError('not-found', 'Customer not found.');
        }

        console.log(`Found customer: ${customerData.name} (ID: ${customerData.customerID}, Firestore ID: ${customerFirestoreId})`);

        // For non-superadmin users, verify they have access to this customer's company
        if (adminUserData.role !== 'superadmin') {
            const customerCompanyId = customerData.companyID;
            const adminConnectedCompanies = adminUserData.connectedCompanies || [];
            
            if (!adminConnectedCompanies.includes(customerCompanyId)) {
                console.error(`adminDeleteCustomer: Admin ${callingUserUid} does not have access to company ${customerCompanyId}`);
                throw new HttpsError('permission-denied', 'You do not have access to delete customers from this company.');
            }
        }

        // Start batch operation for atomic deletion
        const batch = db.batch();

        // 1. Delete customer document
        const customerDocRef = db.collection('customers').doc(customerFirestoreId);
        batch.delete(customerDocRef);
        console.log(`Marked customer document for deletion: ${customerFirestoreId}`);

        // 2. Delete all associated addresses from addressBook
        const addressQuery = db.collection('addressBook')
            .where('addressClass', '==', 'customer')
            .where('addressClassID', '==', customerData.customerID);
        
        const addressSnapshot = await addressQuery.get();
        console.log(`Found ${addressSnapshot.size} addresses to delete for customer ${customerData.customerID}`);
        
        addressSnapshot.docs.forEach(addressDoc => {
            batch.delete(addressDoc.ref);
            console.log(`Marked address for deletion: ${addressDoc.id}`);
        });

        // 3. Check for shipments using this customer
        const shipmentQuery = db.collection('shipments')
            .where('shipTo.customerID', '==', customerData.customerID);
        
        const shipmentSnapshot = await shipmentQuery.get();
        
        if (!shipmentSnapshot.empty) {
            console.log(`Found ${shipmentSnapshot.size} shipments associated with customer ${customerData.customerID}`);
            // Note: We don't delete shipments, but we could update them to remove customer reference
            // For now, we'll just log this information
            console.log('Warning: Customer has associated shipments that will retain customer references');
        }

        // Execute the batch delete
        await batch.commit();
        console.log(`Successfully deleted customer ${customerData.customerID} and ${addressSnapshot.size} associated addresses`);

        return { 
            status: 'success', 
            message: `Customer "${customerData.name}" (${customerData.customerID}) has been deleted successfully.`,
            deletedAddresses: addressSnapshot.size,
            associatedShipments: shipmentSnapshot.size
        };

    } catch (error) {
        console.error(`Error in adminDeleteCustomer for customer ${customerId} by admin ${callingUserUid}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'An internal error occurred while deleting the customer.');
    }
});