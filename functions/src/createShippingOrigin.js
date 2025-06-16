const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Get Firestore instance
const db = admin.firestore();

/**
 * Create a new shipping origin address for a company
 * Called by the AI agent to add new pickup locations
 */
exports.createShippingOrigin = onCall(async (request) => {
    try {
        const { companyId, originData } = request.data;

        // Validate required parameters
        if (!companyId) {
            throw new HttpsError('invalid-argument', 'companyId is required');
        }
        if (!originData) {
            throw new HttpsError('invalid-argument', 'originData is required');
        }

        // Validate required origin fields
        const requiredFields = ['nickname', 'companyName', 'firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'stateProv', 'zipPostal', 'country'];
        const missingFields = requiredFields.filter(field => !originData[field]?.trim());
        
        if (missingFields.length > 0) {
            throw new HttpsError('invalid-argument', `Missing required fields: ${missingFields.join(', ')}`);
        }

        logger.info(`Creating shipping origin for company ${companyId}:`, originData);

        // Get company data to ensure we have the correct companyId format
        const companyRef = db.collection('companies').doc(companyId);
        const companySnap = await companyRef.get();
        if (!companySnap.exists()) {
            throw new HttpsError('not-found', 'Company not found');
        }

        const companyData = companySnap.data();
        // Check for actual company ID - note that the field is "companyID" (capital ID) in the data
        const actualCompanyId = companyData.companyID || companyData.companyId || companyData.customerId || companyData.id || companyId;

        // If this is set as default, unset other defaults first
        if (originData.isDefault) {
            const existingDefaultsQuery = db.collection('addressBook')
                .where('addressClass', '==', 'company')
                .where('addressType', '==', 'origin')
                .where('addressClassID', '==', actualCompanyId)
                .where('isDefault', '==', true);

            const existingDefaults = await existingDefaultsQuery.get();
            const batch = db.batch();

            existingDefaults.forEach(doc => {
                batch.update(doc.ref, { isDefault: false });
            });

            await batch.commit();
            logger.info(`Unset ${existingDefaults.size} existing default origins`);
        }

        // Prepare address data for addressBook collection
        const addressBookData = {
            addressClass: 'company',
            addressClassID: actualCompanyId,
            addressType: 'origin',
            nickname: originData.nickname.trim(),
            companyName: originData.companyName.trim(),
            firstName: originData.firstName.trim(),
            lastName: originData.lastName.trim(),
            email: originData.email.trim(),
            phone: originData.phone.trim(),
            address1: originData.address1.trim(),
            address2: originData.address2?.trim() || '',
            city: originData.city.trim(),
            stateProv: originData.stateProv.trim(),
            zipPostal: originData.zipPostal.trim(),
            country: originData.country.trim(),
            specialInstructions: originData.specialInstructions?.trim() || '',
            isDefault: originData.isDefault || false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add to addressBook collection
        const docRef = await db.collection('addressBook').add(addressBookData);
        logger.info(`Created shipping origin with ID: ${docRef.id}`);

        // Return the created origin with its ID
        const createdOrigin = {
            id: docRef.id,
            ...addressBookData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return {
            success: true,
            data: {
                origin: createdOrigin,
                message: `Shipping origin "${originData.nickname}" created successfully`
            }
        };

    } catch (error) {
        logger.error('Error creating shipping origin:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to create shipping origin: ${error.message}`);
    }
}); 