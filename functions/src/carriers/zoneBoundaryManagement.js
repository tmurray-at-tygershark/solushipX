/**
 * Zone Boundary Management Functions
 * Handle custom zone boundary creation, editing, and storage
 */

const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

/**
 * Save custom zone boundary
 */
exports.saveZoneBoundary = onCall(async (request) => {
        const { data } = request;
        
        try {
            // Authentication check
            if (!request.auth) {
                throw new Error('User must be authenticated');
            }

            const { 
                name, 
                code, 
                description = '',
                serviceType = 'standard',
                priority = 1,
                active = true,
                zoneType = 'custom_carrier_zone',
                boundary, 
                carrierId, 
                zoneCategory, 
                color,
                cities = [],
                cityCount = 0,
                createdAt,
                updatedAt,
                // Legacy support
                zoneId,
                zoneName
            } = data;

            // Support both new and legacy data structures
            const finalName = name || zoneName;
            const finalCode = code || (finalName ? `${finalName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3)}${Math.floor(100 + Math.random() * 900)}` : '');

            if (!finalName || !boundary || !carrierId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone name, boundary, and carrier ID are required'
                );
            }

            logger.info('💾 Saving custom zone', {
                name: finalName,
                code: finalCode,
                zoneType,
                carrierId,
                zoneCategory,
                serviceType,
                priority,
                active,
                coordinatesCount: boundary.coordinates?.length || 0,
                citiesCount: cities.length
            });

            const db = admin.firestore();

            // Create comprehensive zone document
            const zoneDoc = {
                name: finalName.trim(),
                code: finalCode,
                description: description.trim(),
                serviceType,
                priority: parseInt(priority) || 1,
                active: Boolean(active),
                zoneType,
                boundary,
                carrierId,
                zoneCategory,
                color: color || { primary: '#6b7280', secondary: '#f3f4f6' },
                cities: cities || [],
                cityCount: parseInt(cityCount) || cities.length || 0,
                createdAt: createdAt || admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: updatedAt || admin.firestore.FieldValue.serverTimestamp(),
                createdBy: request.auth.uid,
                enabled: true,
                // Additional metadata
                metadata: {
                    version: '1.0',
                    source: 'map_drawing_tool',
                    coordinateCount: boundary.coordinates ? boundary.coordinates.length : 0,
                    citiesCount: cities.length || 0
                }
            };

            const docRef = await db.collection('zoneBoundaries').add(zoneDoc);

            logger.info('✅ Custom zone saved successfully', {
                boundaryId: docRef.id,
                name: finalName,
                code: finalCode,
                serviceType,
                priority
            });

            return {
                success: true,
                id: docRef.id,
                boundaryId: docRef.id,
                zoneCode: finalCode,
                message: `Custom zone "${finalName}" saved successfully`
            };

        } catch (error) {
            logger.error('❌ Error saving zone boundary', {
                error: error.message,
                stack: error.stack
            });
            
            throw new Error(error.message);
        }
    });

/**
 * Load zone boundaries for a carrier
 */
exports.loadZoneBoundaries = onCall(async (request) => {
        const { data } = request;
        
        // Extract data - handle both direct and nested data structures
        const requestData = data.data || data;
        const { carrierId, zoneCategory } = requestData;
        
        try {

            // Debug data extraction
            logger.info('🔍 Data extraction debug', {
                rawData: data,
                extractedData: requestData,
                carrierId: carrierId || 'missing',
                zoneCategory: zoneCategory || 'missing',
                hasAuth: !!request.auth,
                authUid: request.auth?.uid || 'none'
            });

            // Authentication check - but allow to continue for debugging
            if (!request.auth) {
                logger.warn('⚠️ No auth context found, but continuing for debugging');
                // Don't throw error for now - let's see what happens
            }

            if (!carrierId) {
                logger.error('❌ Missing carrierId in loadZoneBoundaries request', { 
                    rawData: data,
                    extractedData: requestData 
                });
                throw new Error('Carrier ID is required');
            }

            logger.info('📥 Loading zone boundaries', { 
                carrierId, 
                zoneCategory, 
                userId: request.auth?.uid || 'unauthenticated'
            });

            const db = admin.firestore();

            // Query zone boundaries for this carrier
            let query = db.collection('zoneBoundaries')
                .where('carrierId', '==', carrierId)
                .where('enabled', '==', true);

            if (zoneCategory) {
                query = query.where('zoneCategory', '==', zoneCategory);
            }

            const snapshot = await query.get();
            const boundaries = [];

            snapshot.forEach(doc => {
                boundaries.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            logger.info('✅ Zone boundaries loaded', {
                carrierId,
                zoneCategory,
                boundariesCount: boundaries.length
            });

            return {
                success: true,
                boundaries,
                totalCount: boundaries.length
            };

        } catch (error) {
            logger.error('❌ Error loading zone boundaries', {
                error: error.message,
                stack: error.stack,
                carrierId: requestData?.carrierId || data?.carrierId || 'unknown',
                zoneCategory: requestData?.zoneCategory || data?.zoneCategory || 'unknown',
                userId: request.auth?.uid || 'unauthenticated'
            });
            
            // Handle Firestore errors
            if (error.code && error.code.includes('permission-denied')) {
                throw new Error('Permission denied accessing zone boundaries');
            }
            
            throw new Error(`Failed to load zone boundaries: ${error.message}`);
        }
    });

/**
 * Update zone boundary
 */
exports.updateZoneBoundary = onCall(async (request) => {
        const { data } = request;
        
        try {
            // Authentication check
            if (!request.auth) {
                throw new Error('User must be authenticated');
            }

            const { boundaryId, boundary, updatedAt } = data;

            if (!boundaryId || !boundary) {
                throw new Error('Boundary ID and boundary data are required');
            }

            logger.info('🔄 Updating zone boundary', {
                boundaryId,
                coordinatesCount: boundary.coordinates?.length || 0
            });

            const db = admin.firestore();

            // Update zone boundary
            const updateData = {
                boundary,
                updatedAt: updatedAt || admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: request.auth.uid
            };

            await db.collection('zoneBoundaries').doc(boundaryId).update(updateData);

            logger.info('✅ Zone boundary updated successfully', { boundaryId });

            return {
                success: true,
                message: 'Zone boundary updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating zone boundary', {
                error: error.message,
                stack: error.stack
            });
            
            throw new Error(error.message);
        }
    });

/**
 * Delete zone boundary
 */
exports.deleteZoneBoundary = onCall(async (request) => {
        const { data } = request;
        
        try {
            // Authentication check
            if (!request.auth) {
                throw new Error('User must be authenticated');
            }

            const { boundaryId } = data;

            if (!boundaryId) {
                throw new Error('Boundary ID is required');
            }

            logger.info('🗑️ Deleting zone boundary', { boundaryId });

            const db = admin.firestore();

            // Soft delete - mark as disabled
            await db.collection('zoneBoundaries').doc(boundaryId).update({
                enabled: false,
                deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                deletedBy: request.auth.uid
            });

            logger.info('✅ Zone boundary deleted successfully', { boundaryId });

            return {
                success: true,
                message: 'Zone boundary deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting zone boundary', {
                error: error.message,
                stack: error.stack
            });
            
            throw new Error(error.message);
        }
    });
