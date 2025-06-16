const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Get Firestore instance
const db = admin.firestore();

/**
 * Create a new destination address for an existing customer
 * Called by the AI agent to add new delivery locations
 */
exports.createCustomerDestination = onCall(async (request) => {
    try {
        const { companyId, customerId, destinationData } = request.data;

        // Validate required parameters
        if (!companyId) {
            throw new HttpsError('invalid-argument', 'companyId is required');
        }
        if (!customerId) {
            throw new HttpsError('invalid-argument', 'customerId is required');
        }
        if (!destinationData) {
            throw new HttpsError('invalid-argument', 'destinationData is required');
        }

        // Validate required destination fields
        const requiredFields = ['nickname', 'firstName', 'lastName', 'address1', 'city', 'state', 'postalCode', 'country'];
        const missingFields = requiredFields.filter(field => !destinationData[field]?.trim());
        
        if (missingFields.length > 0) {
            throw new HttpsError('invalid-argument', `Missing required fields: ${missingFields.join(', ')}`);
        }

        logger.info(`Creating destination for customer ${customerId} in company ${companyId}:`, destinationData);

        // Get company data to ensure we have the correct companyId format
        const companyRef = db.collection('companies').doc(companyId);
        const companySnap = await companyRef.get();
        if (!companySnap.exists()) {
            throw new HttpsError('not-found', 'Company not found');
        }

        const companyData = companySnap.data();
        // Check for actual company ID - note that the field is "companyID" (capital ID) in the data
        const actualCompanyId = companyData.companyID || companyData.companyId || companyData.customerId || companyData.id || companyId;

        // Verify customer exists and belongs to this company
        const customerQuery = db.collection('customers')
            .where('customerID', '==', customerId)
            .where('companyID', '==', actualCompanyId);
        
        const customerSnapshot = await customerQuery.get();
        if (customerSnapshot.empty) {
            throw new HttpsError('not-found', `Customer with ID "${customerId}" not found for this company`);
        }

        // If this is set as default, unset other defaults for this customer first
        if (destinationData.isDefault) {
            const existingDefaultsQuery = db.collection('addressBook')
                .where('addressClass', '==', 'customer')
                .where('addressType', '==', 'destination')
                .where('addressClassID', '==', customerId)
                .where('isDefault', '==', true);

            const existingDefaults = await existingDefaultsQuery.get();
            const batch = db.batch();

            existingDefaults.forEach(doc => {
                batch.update(doc.ref, { isDefault: false });
            });

            await batch.commit();
            logger.info(`Unset ${existingDefaults.size} existing default destinations for customer ${customerId}`);
        }

        // Prepare destination address data for addressBook collection
        const addressBookData = {
            addressClass: 'customer',
            addressClassID: customerId,
            addressType: 'destination',
            nickname: destinationData.nickname.trim(),
            companyName: destinationData.companyName?.trim() || '',
            firstName: destinationData.firstName.trim(),
            lastName: destinationData.lastName.trim(),
            email: destinationData.email?.trim() || '',
            phone: destinationData.phone?.trim() || '',
            attention: `${destinationData.firstName} ${destinationData.lastName}`.trim(),
            // Use field names that match CustomerDetail expectations
            address1: destinationData.address1.trim(),
            address2: destinationData.address2?.trim() || '',
            street: destinationData.address1.trim(), // Keep both for compatibility
            street2: destinationData.address2?.trim() || '',
            city: destinationData.city.trim(),
            stateProv: destinationData.state.trim(),
            state: destinationData.state.trim(), // Keep both for compatibility
            zipPostal: destinationData.postalCode.trim(),
            postalCode: destinationData.postalCode.trim(), // Keep both for compatibility
            country: destinationData.country.trim(),
            specialInstructions: destinationData.specialInstructions?.trim() || '',
            isDefault: destinationData.isDefault || false,
            companyID: actualCompanyId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add to addressBook collection
        const docRef = await db.collection('addressBook').add(addressBookData);
        logger.info(`Created customer destination with ID: ${docRef.id}`);

        // Return the created destination with its ID
        const createdDestination = {
            id: docRef.id,
            ...addressBookData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return {
            success: true,
            data: {
                destination: createdDestination,
                message: `Destination address "${destinationData.nickname}" created successfully for customer ${customerId}`
            }
        };

    } catch (error) {
        logger.error('Error creating customer destination:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to create customer destination: ${error.message}`);
    }
}); 