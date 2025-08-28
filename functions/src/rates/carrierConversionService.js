/**
 * Cloud Functions for QuickShip to Connected Carrier Conversion
 * Handles the conversion process from basic QuickShip carriers to full connected carriers
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Create a connected carrier from QuickShip carrier data
 */
exports.createConnectedCarrier = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            // Validate user role
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            logger.info('🔄 Creating connected carrier from QuickShip', {
                userId: context.auth.uid,
                carrierName: data.name
            });

            // Validate required fields
            const requiredFields = ['name', 'carrierId', 'connectionType'];
            for (const field of requiredFields) {
                if (!data[field]) {
                    throw new functions.https.HttpsError(
                        'invalid-argument',
                        `${field} is required`
                    );
                }
            }

            const db = admin.firestore();

            // Generate a unique carrier key
            const carrierKey = data.carrierId.toUpperCase().replace(/[^A-Z0-9]/g, '_');

            // Prepare connected carrier data
            const connectedCarrierData = {
                // Basic information
                name: data.name,
                carrierId: data.carrierId,
                carrierKey: carrierKey,
                
                // Connection configuration
                connectionType: data.connectionType,
                enabled: data.enabled !== false,
                
                // Contact information
                contactEmail: data.contactEmail || '',
                logo: data.logo || '',
                
                // Services and equipment (transferred from QuickShip)
                supportedServiceLevels: data.supportedServiceLevels || [],
                supportedEquipmentTypes: data.supportedEquipmentTypes || [],
                supportedAdditionalServices: data.supportedAdditionalServices || [],
                
                // Email configuration for manual carriers
                emailContacts: data.emailContacts || [],
                
                // Rate configuration
                rateConfiguration: {
                    enabled: false, // Will be enabled when rate card is created
                    rateType: 'manual',
                    currency: data.currency || 'CAD'
                },
                
                // Conversion metadata
                convertedFrom: 'quickship',
                originalQuickShipId: data.originalQuickShipId || '',
                conversionDate: admin.firestore.FieldValue.serverTimestamp(),
                convertedBy: context.auth.uid,
                
                // Timestamps
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            // API configuration for API carriers
            if (data.connectionType === 'api') {
                connectedCarrierData.apiCredentials = {
                    type: 'custom',
                    username: '',
                    password: '',
                    apiKey: '',
                    apiSecret: '',
                    accountNumber: '',
                    hostURL: '',
                    endpoints: {
                        rate: '',
                        booking: '',
                        tracking: '',
                        cancel: '',
                        labels: '',
                        status: ''
                    }
                };
            }

            // Create the connected carrier
            const carrierRef = await db.collection('carriers').add(connectedCarrierData);

            logger.info('✅ Connected carrier created', {
                carrierId: carrierRef.id,
                carrierKey: carrierKey,
                name: data.name
            });

            return {
                success: true,
                carrierId: carrierRef.id,
                carrierKey: carrierKey,
                message: 'Connected carrier created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating connected carrier', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create connected carrier',
                error.message
            );
        }
    });

/**
 * Update QuickShip carrier to mark as converted
 */
exports.updateQuickShipCarrier = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            // Validate user role
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            if (!data.carrierId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID is required'
                );
            }

            logger.info('🔄 Updating QuickShip carrier', {
                userId: context.auth.uid,
                carrierId: data.carrierId
            });

            const db = admin.firestore();

            // Check if QuickShip carrier exists
            const carrierRef = db.collection('quickshipCarriers').doc(data.carrierId);
            const carrierDoc = await carrierRef.get();
            
            if (!carrierDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'QuickShip carrier not found'
                );
            }

            // Prepare update data
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            // Update allowed fields
            const allowedFields = [
                'convertedToConnected', 'convertedAt', 'connectedCarrierId', 'enabled'
            ];

            allowedFields.forEach(field => {
                if (data.hasOwnProperty(field)) {
                    updateData[field] = data[field];
                }
            });

            // Update the QuickShip carrier
            await carrierRef.update(updateData);

            logger.info('✅ QuickShip carrier updated', {
                carrierId: data.carrierId
            });

            return {
                success: true,
                message: 'QuickShip carrier updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating QuickShip carrier', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to update QuickShip carrier',
                error.message
            );
        }
    });

/**
 * Get conversion candidates (QuickShip carriers that can be converted)
 */
exports.getConversionCandidates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            logger.info('📋 Getting conversion candidates', {
                userId: context.auth.uid
            });

            const db = admin.firestore();

            // Query QuickShip carriers that haven't been converted
            let query = db.collection('quickshipCarriers')
                .where('convertedToConnected', '!=', true)
                .orderBy('name', 'asc');

            // Filter by company if specified
            if (data.companyId) {
                query = query.where('companyID', '==', data.companyId);
            }

            const querySnapshot = await query.get();
            const candidates = [];

            querySnapshot.forEach(doc => {
                const carrierData = doc.data();
                candidates.push({
                    id: doc.id,
                    name: carrierData.name,
                    carrierId: carrierData.carrierId,
                    contactEmail: carrierData.contactEmail,
                    companyID: carrierData.companyID,
                    supportedServiceLevels: carrierData.supportedServiceLevels || [],
                    supportedEquipmentTypes: carrierData.supportedEquipmentTypes || [],
                    supportedAdditionalServices: carrierData.supportedAdditionalServices || [],
                    enabled: carrierData.enabled,
                    createdAt: carrierData.createdAt
                });
            });

            logger.info('✅ Retrieved conversion candidates', {
                count: candidates.length
            });

            return {
                success: true,
                candidates
            };

        } catch (error) {
            logger.error('❌ Error getting conversion candidates', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to get conversion candidates',
                error.message
            );
        }
    });

/**
 * Migrate data from QuickShip carrier to connected carrier format
 */
function migrateCarrierData(quickShipData) {
    return {
        // Basic information
        name: quickShipData.name || '',
        carrierId: quickShipData.carrierId || '',
        contactEmail: quickShipData.contactEmail || '',
        logo: quickShipData.logo || '',
        
        // Default to manual connection
        connectionType: 'manual',
        
        // Transfer service configurations
        supportedServiceLevels: quickShipData.supportedServiceLevels || [],
        supportedEquipmentTypes: quickShipData.supportedEquipmentTypes || [],
        supportedAdditionalServices: quickShipData.supportedAdditionalServices || [],
        
        // Email configuration from contact email
        emailContacts: quickShipData.contactEmail ? [{
            type: 'general',
            email: quickShipData.contactEmail,
            name: quickShipData.contactName || 'General Contact'
        }] : [],
        
        // Enable rate configuration by default
        rateConfiguration: {
            enabled: true,
            rateType: 'skid', // Default to skid-based
            currency: 'CAD'
        },
        
        // Preserve metadata
        originalData: {
            quickShipId: quickShipData.id,
            originalCompanyID: quickShipData.companyID,
            originalCreatedAt: quickShipData.createdAt
        }
    };
}
