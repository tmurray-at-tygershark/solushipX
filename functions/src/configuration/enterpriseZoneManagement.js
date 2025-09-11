/**
 * Enterprise Zone Management System
 * Based on battle-tested patterns for 1,000+ carriers
 * Implements: Regions → ZoneSets → Zone Maps → Carrier Bindings → Overrides
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Get all regions (atomic geo keys)
 */
exports.getRegions = functions
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

            logger.info('🌍 Loading regions', {
                userId: context.auth.uid
            });

            const db = admin.firestore();
            const regionsSnapshot = await db.collection('regions').get();

            const regions = [];
            regionsSnapshot.forEach(doc => {
                regions.push({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
                    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null
                });
            });

            // Sort by type, then code
            regions.sort((a, b) => {
                if (a.type !== b.type) return a.type.localeCompare(b.type);
                return a.code.localeCompare(b.code);
            });

            logger.info('✅ Regions loaded successfully', {
                totalRegions: regions.length
            });

            return {
                success: true,
                regions
            };

        } catch (error) {
            logger.error('❌ Error loading regions', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load regions',
                error.message
            );
        }
    });

/**
 * Create a new region
 */
exports.createRegion = functions
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
            if (!data.type || !data.code || !data.name) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Type, code, and name are required'
                );
            }

            logger.info('🌍 Creating region', {
                userId: context.auth.uid,
                regionData: data
            });

            const db = admin.firestore();

            // Create region data
            const regionData = {
                type: data.type.trim().toLowerCase(), // 'country', 'state_province', 'fsa', 'zip3', 'city'
                code: data.code.trim().toUpperCase(),
                name: data.name.trim(),
                parentRegionId: data.parentRegionId || null, // e.g., ON points to CA
                patterns: data.patterns || [], // regex patterns for matching
                enabled: data.enabled !== false,
                metadata: data.metadata || {},
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            // Check for duplicates
            const duplicateQuery = await db.collection('regions')
                .where('type', '==', regionData.type)
                .where('code', '==', regionData.code)
                .get();

            if (!duplicateQuery.empty) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    'A region with this type and code already exists'
                );
            }

            // Create the region
            const regionRef = await db.collection('regions').add(regionData);

            logger.info('✅ Region created successfully', {
                regionId: regionRef.id,
                regionName: regionData.name
            });

            return {
                success: true,
                regionId: regionRef.id,
                message: 'Region created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating region', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create region',
                error.message
            );
        }
    });

/**
 * Get all zone sets (reusable zone templates)
 */
exports.getZoneSets = functions
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

            logger.info('📍 Loading zone sets', {
                userId: context.auth.uid
            });

            const db = admin.firestore();
            const zoneSetsSnapshot = await db.collection('zoneSets').get();

            const zoneSets = [];
            zoneSetsSnapshot.forEach(doc => {
                zoneSets.push({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
                    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
                    effectiveFrom: doc.data().effectiveFrom?.toDate?.()?.toISOString() || null,
                    effectiveTo: doc.data().effectiveTo?.toDate?.()?.toISOString() || null
                });
            });

            // Sort by name, then version
            zoneSets.sort((a, b) => {
                if (a.name !== b.name) return a.name.localeCompare(b.name);
                return (a.version || 1) - (b.version || 1);
            });

            logger.info('✅ Zone sets loaded successfully', {
                totalZoneSets: zoneSets.length
            });

            return {
                success: true,
                zoneSets
            };

        } catch (error) {
            logger.error('❌ Error loading zone sets', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load zone sets',
                error.message
            );
        }
    });

/**
 * Create a new zone set
 */
exports.createZoneSet = functions
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
            if (!data.name) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Name is required'
                );
            }

            if (!data.selectedZones || !Array.isArray(data.selectedZones) || data.selectedZones.length === 0) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'At least one zone must be selected'
                );
            }

            logger.info('📍 Creating zone set', {
                userId: context.auth.uid,
                zoneSetData: data
            });

            const db = admin.firestore();

            // Create zone set data
            const zoneSetData = {
                name: data.name.trim(),
                description: data.description?.trim() || '',
                selectedZones: data.selectedZones || [], // Array of zone IDs
                zoneCount: data.zoneCount || data.selectedZones?.length || 0,
                enabled: data.enabled !== false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: context.auth.uid
            };

            // Check for duplicates (same name)
            const duplicateQuery = await db.collection('zoneSets')
                .where('name', '==', zoneSetData.name)
                .get();

            if (!duplicateQuery.empty) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    'A zone set with this name already exists'
                );
            }

            // Create the zone set
            const zoneSetRef = await db.collection('zoneSets').add(zoneSetData);

            logger.info('✅ Zone set created successfully', {
                zoneSetId: zoneSetRef.id,
                zoneSetName: zoneSetData.name
            });

            return {
                success: true,
                zoneSetId: zoneSetRef.id,
                message: 'Zone set created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating zone set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create zone set',
                error.message
            );
        }
    });

/**
 * Delete a zone set
 */
exports.deleteZoneSet = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
        cors: true
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
            if (!data.zoneSetId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone set ID is required'
                );
            }

            logger.info('🗑️ Deleting zone set', {
                userId: context.auth.uid,
                zoneSetId: data.zoneSetId
            });

            const db = admin.firestore();
            const zoneSetRef = db.collection('zoneSets').doc(data.zoneSetId);
            
            // Check if zone set exists
            const zoneSetDoc = await zoneSetRef.get();
            if (!zoneSetDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Zone set not found'
                );
            }

            // Delete the zone set
            await zoneSetRef.delete();

            logger.info('✅ Zone set deleted successfully', {
                zoneSetId: data.zoneSetId
            });

            return {
                success: true,
                message: 'Zone set deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting zone set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to delete zone set',
                error.message
            );
        }
    });

/**
 * Get zone maps for a specific zone set
 */
exports.getZoneMaps = functions
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

            if (!data.zoneSetId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone set ID is required'
                );
            }

            logger.info('🗺️ Loading zone maps', {
                userId: context.auth.uid,
                zoneSetId: data.zoneSetId
            });

            const db = admin.firestore();
            const zoneMapsSnapshot = await db.collection('zoneMaps')
                .where('zoneSetId', '==', data.zoneSetId)
                .get();

            const zoneMaps = [];
            zoneMapsSnapshot.forEach(doc => {
                zoneMaps.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            logger.info('✅ Zone maps loaded successfully', {
                totalZoneMaps: zoneMaps.length,
                zoneSetId: data.zoneSetId
            });

            return {
                success: true,
                zoneMaps,
                zoneSetId: data.zoneSetId
            };

        } catch (error) {
            logger.error('❌ Error loading zone maps', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load zone maps',
                error.message
            );
        }
    });

/**
 * Resolve zone code for origin/destination pair
 * Fast lookup with caching for hot lanes
 */
exports.resolveZone = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
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

            if (!data.carrierId || !data.serviceId || !data.originPostal || !data.destPostal) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, service ID, origin postal, and destination postal are required'
                );
            }

            logger.info('🔍 Resolving zone', {
                userId: context.auth.uid,
                carrierId: data.carrierId,
                serviceId: data.serviceId,
                originPostal: data.originPostal,
                destPostal: data.destPostal
            });

            const db = admin.firestore();

            // 1) Canonicalize postal codes to region IDs
            const originRegion = await canonicalizePostalToRegion(db, data.originPostal);
            const destRegion = await canonicalizePostalToRegion(db, data.destPostal);

            // 2) Find active zone set for this carrier/service
            const zoneSet = await getActiveZoneSet(db, data.carrierId, data.serviceId, new Date());

            if (!zoneSet) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'No active zone set found for this carrier and service'
                );
            }

            // 3) Create cache key
            const shipDate = data.shipDate || new Date().toISOString().substring(0, 7); // YYYY-MM
            const cacheKey = `${data.carrierId}|${data.serviceId}|${zoneSet.id}|${originRegion.id}|${destRegion.id}|${shipDate}`;

            // 4) Try cache first (in production, use Redis or Memcache)
            // For now, we'll compute directly

            // 5) Try override first, then base zone map
            let zoneCode = await lookupZoneOverride(db, data.carrierId, data.serviceId, originRegion.id, destRegion.id);
            
            if (!zoneCode) {
                zoneCode = await lookupZoneMap(db, zoneSet.id, originRegion.id, destRegion.id);
            }

            if (!zoneCode) {
                // Fallback to parent regions (e.g., city -> state -> country)
                zoneCode = await fallbackZoneLookup(db, zoneSet.id, originRegion, destRegion);
            }

            if (!zoneCode) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'No zone mapping found for this origin/destination pair'
                );
            }

            logger.info('✅ Zone resolved successfully', {
                zoneCode,
                originRegion: originRegion.code,
                destRegion: destRegion.code,
                zoneSetId: zoneSet.id
            });

            return {
                success: true,
                zoneCode,
                originRegion,
                destRegion,
                zoneSet: {
                    id: zoneSet.id,
                    name: zoneSet.name,
                    version: zoneSet.version
                },
                cacheKey
            };

        } catch (error) {
            logger.error('❌ Error resolving zone', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to resolve zone',
                error.message
            );
        }
    });

// Helper functions

async function canonicalizePostalToRegion(db, postalCode) {
    // Convert postal code to smallest shared region (FSA for CA, ZIP3 for US, etc.)
    const cleanPostal = postalCode.replace(/\s/g, '').toUpperCase();
    
    // Determine country and region type
    let regionType, regionCode;
    
    if (/^[A-Z]\d[A-Z]/.test(cleanPostal)) {
        // Canadian FSA
        regionType = 'fsa';
        regionCode = cleanPostal.substring(0, 3);
    } else if (/^\d{5}/.test(cleanPostal)) {
        // US ZIP code -> ZIP3
        regionType = 'zip3';
        regionCode = cleanPostal.substring(0, 3);
    } else {
        throw new Error('Unsupported postal code format');
    }

    // Look up region
    const regionQuery = await db.collection('regions')
        .where('type', '==', regionType)
        .where('code', '==', regionCode)
        .limit(1)
        .get();

    if (regionQuery.empty) {
        throw new Error(`Region not found for ${regionType}: ${regionCode}`);
    }

    const regionDoc = regionQuery.docs[0];
    return {
        id: regionDoc.id,
        ...regionDoc.data()
    };
}

async function getActiveZoneSet(db, carrierId, serviceId, date) {
    const bindingsQuery = await db.collection('carrierZoneBindings')
        .where('carrierId', '==', carrierId)
        .where('serviceId', '==', serviceId)
        .where('effectiveFrom', '<=', admin.firestore.Timestamp.fromDate(date))
        .where('effectiveTo', '>=', admin.firestore.Timestamp.fromDate(date))
        .orderBy('priority', 'desc')
        .limit(1)
        .get();

    if (bindingsQuery.empty) {
        return null;
    }

    const binding = bindingsQuery.docs[0].data();
    
    // Get the zone set
    const zoneSetDoc = await db.collection('zoneSets').doc(binding.zoneSetId).get();
    if (!zoneSetDoc.exists) {
        return null;
    }

    return {
        id: zoneSetDoc.id,
        ...zoneSetDoc.data()
    };
}

async function lookupZoneOverride(db, carrierId, serviceId, originRegionId, destRegionId) {
    const overrideQuery = await db.collection('carrierZoneOverrides')
        .where('carrierId', '==', carrierId)
        .where('serviceId', '==', serviceId)
        .where('originRegionId', '==', originRegionId)
        .where('destRegionId', '==', destRegionId)
        .limit(1)
        .get();

    if (overrideQuery.empty) {
        return null;
    }

    return overrideQuery.docs[0].data().zoneCode;
}

async function lookupZoneMap(db, zoneSetId, originRegionId, destRegionId) {
    const mapQuery = await db.collection('zoneMaps')
        .where('zoneSetId', '==', zoneSetId)
        .where('originRegionId', '==', originRegionId)
        .where('destRegionId', '==', destRegionId)
        .limit(1)
        .get();

    if (mapQuery.empty) {
        return null;
    }

    return mapQuery.docs[0].data().zoneCode;
}

async function fallbackZoneLookup(db, zoneSetId, originRegion, destRegion) {
    // Implement hierarchical fallback: try parent regions
    // For now, return null - implement based on specific needs
    return null;
}
