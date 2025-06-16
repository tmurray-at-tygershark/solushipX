const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Get Firestore instance
const db = admin.firestore();

/**
 * Create a new customer with contact and address information
 * Called by the AI agent to add new customers
 */
exports.createCustomer = onCall(async (request) => {
    try {
        const { companyId, customerData } = request.data;

        // Validate required parameters
        if (!companyId) {
            throw new HttpsError('invalid-argument', 'companyId is required');
        }
        if (!customerData) {
            throw new HttpsError('invalid-argument', 'customerData is required');
        }

        // Validate required customer fields
        const requiredFields = ['customerID', 'name', 'status', 'type'];
        const missingFields = requiredFields.filter(field => !customerData[field]);
        
        if (missingFields.length > 0) {
            throw new HttpsError('invalid-argument', `Missing required customer fields: ${missingFields.join(', ')}`);
        }

        // Validate main contact fields
        if (!customerData.mainContact) {
            throw new HttpsError('invalid-argument', 'mainContact is required');
        }

        const requiredContactFields = ['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'state', 'postalCode', 'country'];
        const missingContactFields = requiredContactFields.filter(field => !customerData.mainContact[field]?.trim());
        
        if (missingContactFields.length > 0) {
            throw new HttpsError('invalid-argument', `Missing required main contact fields: ${missingContactFields.join(', ')}`);
        }

        logger.info(`Creating customer for company ${companyId}:`, customerData);

        // Get company data to ensure we have the correct companyId format
        const companyRef = db.collection('companies').doc(companyId);
        const companySnap = await companyRef.get();
        if (!companySnap.exists()) {
            throw new HttpsError('not-found', 'Company not found');
        }

        const companyData = companySnap.data();
        // Check for actual company ID - note that the field is "companyID" (capital ID) in the data
        const actualCompanyId = companyData.companyID || companyData.companyId || companyData.customerId || companyData.id || companyId;

        // Check if customer ID already exists for this company
        const existingCustomerQuery = db.collection('customers')
            .where('customerID', '==', customerData.customerID.trim())
            .where('companyID', '==', actualCompanyId);
        
        const existingCustomers = await existingCustomerQuery.get();
        if (!existingCustomers.empty) {
            throw new HttpsError('already-exists', `Customer with ID "${customerData.customerID}" already exists for this company`);
        }

        const userDefinedCustomerID = customerData.customerID.trim();

        // Prepare customer core data
        const customerCoreData = {
            customerID: userDefinedCustomerID,
            name: customerData.name.trim(),
            status: customerData.status,
            companyID: actualCompanyId,
            type: customerData.type,
            // Main contact information stored directly in customer record
            contactName: `${customerData.mainContact.firstName} ${customerData.mainContact.lastName}`.trim(),
            email: customerData.mainContact.email.trim(),
            phone: customerData.mainContact.phone.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Prepare main contact address data for addressBook
        const mainContactAddressData = {
            addressClass: 'customer',
            addressClassID: userDefinedCustomerID,
            addressType: 'contact',
            nickname: 'Main Contact',
            firstName: customerData.mainContact.firstName.trim(),
            lastName: customerData.mainContact.lastName.trim(),
            email: customerData.mainContact.email.trim(),
            phone: customerData.mainContact.phone.trim(),
            companyName: customerData.mainContact.companyName?.trim() || customerData.name.trim(),
            attention: `${customerData.mainContact.firstName} ${customerData.mainContact.lastName}`.trim(),
            // Use field names that match CustomerDetail expectations
            address1: customerData.mainContact.address1.trim(),
            address2: customerData.mainContact.address2?.trim() || '',
            street: customerData.mainContact.address1.trim(), // Keep both for compatibility
            street2: customerData.mainContact.address2?.trim() || '',
            city: customerData.mainContact.city.trim(),
            stateProv: customerData.mainContact.state.trim(),
            state: customerData.mainContact.state.trim(), // Keep both for compatibility
            zipPostal: customerData.mainContact.postalCode.trim(),
            postalCode: customerData.mainContact.postalCode.trim(), // Keep both for compatibility
            country: customerData.mainContact.country.trim(),
            specialInstructions: customerData.mainContact.specialInstructions?.trim() || '',
            isDefault: false,
            companyID: actualCompanyId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Create default destination address (same as main contact)
        const defaultDestinationAddressData = {
            ...mainContactAddressData,
            addressType: 'destination',
            nickname: 'Primary Destination',
            isDefault: true,
        };

        // Use a batch to ensure all operations succeed or fail together
        const batch = db.batch();

        // Create customer document
        const customerDocRef = db.collection('customers').doc();
        batch.set(customerDocRef, customerCoreData);

        // Create main contact address
        const contactAddressRef = db.collection('addressBook').doc();
        batch.set(contactAddressRef, mainContactAddressData);

        // Create default destination address
        const destinationAddressRef = db.collection('addressBook').doc();
        batch.set(destinationAddressRef, defaultDestinationAddressData);

        // Commit the batch
        await batch.commit();

        logger.info(`Created customer with ID: ${customerDocRef.id}, customerID: ${userDefinedCustomerID}`);

        // Return the created customer data
        const createdCustomer = {
            id: customerDocRef.id,
            ...customerCoreData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return {
            success: true,
            data: {
                customer: createdCustomer,
                contactAddressId: contactAddressRef.id,
                destinationAddressId: destinationAddressRef.id,
                message: `Customer "${customerData.name}" created successfully with contact and destination addresses`
            }
        };

    } catch (error) {
        logger.error('Error creating customer:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to create customer: ${error.message}`);
    }
}); 