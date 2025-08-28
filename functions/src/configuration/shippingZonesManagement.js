/**
 * Cloud Functions for Shipping Zones Management
 * Handles hierarchical geographic zones: Country > State/Province > City
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Get all shipping zones (hierarchical structure)
 */
exports.getShippingZones = functions
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

            logger.info('📍 Loading shipping zones', {
                userId: context.auth.uid,
                userRole: userData.role
            });

            const db = admin.firestore();

            // Get all zones and organize hierarchically
            const zonesSnapshot = await db.collection('shippingZones').get();

            const zones = [];
            const zoneHierarchy = {};

            // Convert to array and sort client-side to avoid complex composite index
            const allZones = [];
            zonesSnapshot.forEach(doc => {
                allZones.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Sort zones client-side by country, stateProvince, city
            allZones.sort((a, b) => {
                if (a.country !== b.country) return a.country.localeCompare(b.country);
                if ((a.stateProvince || '') !== (b.stateProvince || '')) return (a.stateProvince || '').localeCompare(b.stateProvince || '');
                return (a.city || '').localeCompare(b.city || '');
            });

            allZones.forEach(zone => {
                // Convert Firestore timestamps to ISO strings
                const processedZone = {
                    ...zone,
                    createdAt: zone.createdAt?.toDate?.()?.toISOString() || null,
                    updatedAt: zone.updatedAt?.toDate?.()?.toISOString() || null
                };
                zones.push(processedZone);

                // Build hierarchy for easy UI consumption
                const { country, stateProvince, city } = zone;
                
                if (!zoneHierarchy[country]) {
                    zoneHierarchy[country] = {
                        code: country,
                        name: getCountryName(country),
                        states: {}
                    };
                }

                if (stateProvince && !zoneHierarchy[country].states[stateProvince]) {
                    zoneHierarchy[country].states[stateProvince] = {
                        code: stateProvince,
                        name: getStateProvinceName(stateProvince, country),
                        cities: {}
                    };
                }

                if (city && stateProvince) {
                    zoneHierarchy[country].states[stateProvince].cities[city] = {
                        code: city,
                        name: city,
                        zoneId: zone.id
                    };
                }
            });

            logger.info('✅ Shipping zones loaded successfully', {
                totalZones: zones.length,
                countries: Object.keys(zoneHierarchy).length
            });

            return {
                success: true,
                zones,
                hierarchy: zoneHierarchy
            };

        } catch (error) {
            logger.error('❌ Error loading shipping zones', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load shipping zones',
                error.message
            );
        }
    });

/**
 * Create a new shipping zone
 */
exports.createShippingZone = functions
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

            // Validate required fields
            if (!data.country) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Country is required'
                );
            }

            logger.info('📍 Creating shipping zone', {
                userId: context.auth.uid,
                zoneData: data
            });

            const db = admin.firestore();

            // Create zone data
            const zoneData = {
                country: data.country.trim().toUpperCase(),
                stateProvince: data.stateProvince?.trim() || null,
                city: data.city?.trim() || null,
                zoneName: data.zoneName?.trim() || generateZoneName(data),
                zoneCode: data.zoneCode?.trim() || generateZoneCode(data),
                description: data.description?.trim() || '',
                enabled: data.enabled !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            // Check for duplicates
            const duplicateQuery = db.collection('shippingZones')
                .where('country', '==', zoneData.country);

            if (zoneData.stateProvince) {
                duplicateQuery.where('stateProvince', '==', zoneData.stateProvince);
            }
            if (zoneData.city) {
                duplicateQuery.where('city', '==', zoneData.city);
            }

            const duplicateCheck = await duplicateQuery.get();
            if (!duplicateCheck.empty) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    'A zone with this geographic combination already exists'
                );
            }

            // Create the zone
            const zoneRef = await db.collection('shippingZones').add(zoneData);

            logger.info('✅ Shipping zone created successfully', {
                zoneId: zoneRef.id,
                zoneName: zoneData.zoneName
            });

            return {
                success: true,
                zoneId: zoneRef.id,
                message: 'Shipping zone created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating shipping zone', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create shipping zone',
                error.message
            );
        }
    });

/**
 * Update a shipping zone
 */
exports.updateShippingZone = functions
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

            if (!data.zoneId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone ID is required'
                );
            }

            logger.info('📍 Updating shipping zone', {
                userId: context.auth.uid,
                zoneId: data.zoneId
            });

            const db = admin.firestore();
            const zoneRef = db.collection('shippingZones').doc(data.zoneId);
            
            // Check if zone exists
            const zoneDoc = await zoneRef.get();
            if (!zoneDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Shipping zone not found'
                );
            }

            // Update zone data
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: context.auth.uid
            };

            if (data.country) updateData.country = data.country.trim().toUpperCase();
            if (data.stateProvince !== undefined) updateData.stateProvince = data.stateProvince?.trim() || null;
            if (data.city !== undefined) updateData.city = data.city?.trim() || null;
            if (data.zoneName) updateData.zoneName = data.zoneName.trim();
            if (data.zoneCode) updateData.zoneCode = data.zoneCode.trim();
            if (data.description !== undefined) updateData.description = data.description?.trim() || '';
            if (data.enabled !== undefined) updateData.enabled = data.enabled;

            await zoneRef.update(updateData);

            logger.info('✅ Shipping zone updated successfully', {
                zoneId: data.zoneId
            });

            return {
                success: true,
                message: 'Shipping zone updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating shipping zone', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to update shipping zone',
                error.message
            );
        }
    });

/**
 * Delete a shipping zone
 */
exports.deleteShippingZone = functions
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

            if (!data.zoneId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone ID is required'
                );
            }

            logger.info('🗑️ Deleting shipping zone', {
                userId: context.auth.uid,
                zoneId: data.zoneId
            });

            const db = admin.firestore();
            const zoneRef = db.collection('shippingZones').doc(data.zoneId);
            
            // Check if zone exists
            const zoneDoc = await zoneRef.get();
            if (!zoneDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Shipping zone not found'
                );
            }

            // Check if zone is being used in rate cards
            const rateCardsCheck = await db.collection('carrierRateCards')
                .where('zones', 'array-contains-any', [
                    zoneDoc.data().country,
                    zoneDoc.data().stateProvince,
                    zoneDoc.data().city
                ])
                .limit(1)
                .get();

            if (!rateCardsCheck.empty) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'Cannot delete zone: it is being used in rate cards'
                );
            }

            // Delete the zone
            await zoneRef.delete();

            logger.info('✅ Shipping zone deleted successfully', {
                zoneId: data.zoneId
            });

            return {
                success: true,
                message: 'Shipping zone deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting shipping zone', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to delete shipping zone',
                error.message
            );
        }
    });

/**
 * Helper function to generate zone name
 */
function generateZoneName(data) {
    const parts = [];
    if (data.city) parts.push(data.city);
    if (data.stateProvince) parts.push(data.stateProvince);
    if (data.country) parts.push(getCountryName(data.country));
    return parts.join(', ') || data.country;
}

/**
 * Helper function to generate zone code
 */
function generateZoneCode(data) {
    const parts = [];
    if (data.city) parts.push(data.city.substring(0, 3).toUpperCase());
    if (data.stateProvince) parts.push(data.stateProvince);
    if (data.country) parts.push(data.country);
    return parts.join('-') || data.country;
}

/**
 * Helper function to get country name from code
 */
function getCountryName(code) {
    const countries = {
        'US': 'United States',
        'CA': 'Canada',
        'MX': 'Mexico'
    };
    return countries[code] || code;
}

/**
 * Helper function to get state/province name from code
 */
function getStateProvinceName(code, country) {
    // Canadian provinces
    const canadianProvinces = {
        'ON': 'Ontario',
        'QC': 'Quebec', 
        'BC': 'British Columbia',
        'AB': 'Alberta',
        'MB': 'Manitoba',
        'SK': 'Saskatchewan',
        'NS': 'Nova Scotia',
        'NB': 'New Brunswick',
        'PE': 'Prince Edward Island',
        'NL': 'Newfoundland and Labrador',
        'NU': 'Nunavut',
        'NT': 'Northwest Territories',
        'YT': 'Yukon'
    };

    // US states (major ones)
    const usStates = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
        'WI': 'Wisconsin', 'WY': 'Wyoming'
    };

    if (country === 'CA') {
        return canadianProvinces[code] || code;
    } else if (country === 'US') {
        return usStates[code] || code;
    }
    
    return code;
}
