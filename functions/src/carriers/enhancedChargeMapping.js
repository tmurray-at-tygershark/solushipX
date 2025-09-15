/**
 * Enhanced Charge Mapping Cloud Functions
 * Comprehensive rate card management per route with services and service types
 */

const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Get carrier routes for charge mapping
 */
exports.getCarrierRoutes = onCall(async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { carrierId } = request.data;

        if (!carrierId) {
            throw new Error('Carrier ID is required');
        }

        logger.info('🛣️ Getting carrier routes', {
            carrierId,
            userId: request.auth.uid
        });

        // Get routes from carrierRoutes collection
        const routesQuery = db.collection('carrierRoutes')
            .where('carrierId', '==', carrierId)
            .orderBy('createdAt', 'desc');

        const routesSnapshot = await routesQuery.get();

        const routes = [];
        routesSnapshot.forEach(doc => {
            const routeData = doc.data();
            routes.push({
                id: doc.id,
                ...routeData,
                createdAt: routeData.createdAt?.toDate?.() || null,
                updatedAt: routeData.updatedAt?.toDate?.() || null
            });
        });

        logger.info('✅ Carrier routes retrieved', {
            carrierId,
            routeCount: routes.length
        });

        return {
            success: true,
            routes,
            message: `Found ${routes.length} routes for carrier`
        };

    } catch (error) {
        logger.error('❌ Error getting carrier routes', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: error.message,
            routes: []
        };
    }
});

/**
 * Create enhanced rate card for specific route, service, and service type
 */
exports.createEnhancedRateCard = onCall(async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { carrierId, routeId, service, serviceType, rateType, currency, enabled, skidRates, weightRates, notes } = request.data;

        // Validate required fields
        if (!carrierId || !routeId || !service || !serviceType || !rateType) {
            throw new Error('Carrier ID, route ID, service, service type, and rate type are required');
        }

        logger.info('🆕 Creating enhanced rate card', {
            carrierId,
            routeId,
            service,
            serviceType,
            rateType,
            userId: request.auth.uid
        });

        // Get carrier information
        const carrierDoc = await db.collection('quickshipCarriers').doc(carrierId).get();
        if (!carrierDoc.exists) {
            throw new Error('Carrier not found');
        }

        const carrierData = carrierDoc.data();

        // Get route information
        const routeDoc = await db.collection('carrierRoutes').doc(routeId).get();
        if (!routeDoc.exists) {
            throw new Error('Route not found');
        }

        const routeData = routeDoc.data();

        // Check if rate card already exists for this combination
        const existingRateCardQuery = db.collection('enhancedRateCards')
            .where('carrierId', '==', carrierId)
            .where('routeId', '==', routeId)
            .where('service', '==', service)
            .where('serviceType', '==', serviceType);

        const existingSnapshot = await existingRateCardQuery.get();
        if (!existingSnapshot.empty) {
            throw new Error('Rate card already exists for this route, service, and service type combination');
        }

        // Prepare rate card data
        const rateCardData = {
            carrierId,
            carrierName: carrierData.name,
            routeId,
            routeDescription: routeData.description || `${routeData.pickup?.city} → ${routeData.delivery?.city}`,
            service,
            serviceType,
            rateType,
            currency: currency || 'CAD',
            enabled: enabled !== false,
            
            // Rate configuration
            skidRates: skidRates || [],
            weightRates: weightRates || [],
            notes: notes || '',
            
            // Route information for reference
            pickup: routeData.pickup,
            delivery: routeData.delivery,
            
            // Metadata
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid
        };

        // Create the rate card
        const rateCardRef = await db.collection('enhancedRateCards').add(rateCardData);

        logger.info('✅ Enhanced rate card created', {
            rateCardId: rateCardRef.id,
            carrierId,
            routeId,
            service,
            serviceType
        });

        return {
            success: true,
            rateCardId: rateCardRef.id,
            message: 'Enhanced rate card created successfully'
        };

    } catch (error) {
        logger.error('❌ Error creating enhanced rate card', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Update enhanced rate card
 */
exports.updateEnhancedRateCard = onCall(async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { rateCardId, service, serviceType, rateType, currency, enabled, skidRates, weightRates, notes } = request.data;

        if (!rateCardId) {
            throw new Error('Rate card ID is required');
        }

        logger.info('🔄 Updating enhanced rate card', {
            rateCardId,
            userId: request.auth.uid
        });

        // Check if rate card exists
        const rateCardRef = db.collection('enhancedRateCards').doc(rateCardId);
        const rateCardDoc = await rateCardRef.get();

        if (!rateCardDoc.exists) {
            throw new Error('Rate card not found');
        }

        const existingData = rateCardDoc.data();

        // Prepare update data
        const updateData = {
            service: service || existingData.service,
            serviceType: serviceType || existingData.serviceType,
            rateType: rateType || existingData.rateType,
            currency: currency || existingData.currency,
            enabled: enabled !== undefined ? enabled : existingData.enabled,
            skidRates: skidRates || existingData.skidRates,
            weightRates: weightRates || existingData.weightRates,
            notes: notes !== undefined ? notes : existingData.notes,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Update the rate card
        await rateCardRef.update(updateData);

        logger.info('✅ Enhanced rate card updated', {
            rateCardId
        });

        return {
            success: true,
            message: 'Enhanced rate card updated successfully'
        };

    } catch (error) {
        logger.error('❌ Error updating enhanced rate card', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Get enhanced rate cards for a carrier
 */
exports.getEnhancedRateCards = onCall(async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { carrierId, routeId } = request.data;

        if (!carrierId) {
            throw new Error('Carrier ID is required');
        }

        logger.info('📋 Getting enhanced rate cards', {
            carrierId,
            routeId: routeId || 'all',
            userId: request.auth.uid
        });

        // Build query
        let query = db.collection('enhancedRateCards')
            .where('carrierId', '==', carrierId);

        if (routeId) {
            query = query.where('routeId', '==', routeId);
        }

        query = query.orderBy('createdAt', 'desc');

        const rateCardsSnapshot = await query.get();

        const rateCards = [];
        rateCardsSnapshot.forEach(doc => {
            const rateCardData = doc.data();
            rateCards.push({
                id: doc.id,
                ...rateCardData,
                createdAt: rateCardData.createdAt?.toDate?.() || null,
                updatedAt: rateCardData.updatedAt?.toDate?.() || null
            });
        });

        logger.info('✅ Enhanced rate cards retrieved', {
            carrierId,
            rateCardCount: rateCards.length
        });

        return {
            success: true,
            rateCards,
            message: `Found ${rateCards.length} rate cards`
        };

    } catch (error) {
        logger.error('❌ Error getting enhanced rate cards', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: error.message,
            rateCards: []
        };
    }
});

/**
 * Delete enhanced rate card
 */
exports.deleteEnhancedRateCard = onCall(async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { rateCardId } = request.data;

        if (!rateCardId) {
            throw new Error('Rate card ID is required');
        }

        logger.info('🗑️ Deleting enhanced rate card', {
            rateCardId,
            userId: request.auth.uid
        });

        // Check if rate card exists
        const rateCardRef = db.collection('enhancedRateCards').doc(rateCardId);
        const rateCardDoc = await rateCardRef.get();

        if (!rateCardDoc.exists) {
            throw new Error('Rate card not found');
        }

        // Delete the rate card
        await rateCardRef.delete();

        logger.info('✅ Enhanced rate card deleted', {
            rateCardId
        });

        return {
            success: true,
            message: 'Enhanced rate card deleted successfully'
        };

    } catch (error) {
        logger.error('❌ Error deleting enhanced rate card', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Calculate rates using enhanced rate cards
 */
exports.calculateEnhancedChargeMappingRates = onCall(async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { carrierId, routeId, service, serviceType, skidCount, totalWeight } = request.data;

        if (!carrierId || !routeId || !service || !serviceType) {
            throw new Error('Carrier ID, route ID, service, and service type are required');
        }

        logger.info('💰 Calculating enhanced rates', {
            carrierId,
            routeId,
            service,
            serviceType,
            skidCount: skidCount || 0,
            totalWeight: totalWeight || 0,
            userId: request.auth.uid
        });

        // Find matching rate card
        const rateCardQuery = db.collection('enhancedRateCards')
            .where('carrierId', '==', carrierId)
            .where('routeId', '==', routeId)
            .where('service', '==', service)
            .where('serviceType', '==', serviceType)
            .where('enabled', '==', true);

        const rateCardSnapshot = await rateCardQuery.get();

        if (rateCardSnapshot.empty) {
            return {
                success: false,
                message: 'No matching rate card found',
                rate: null
            };
        }

        const rateCard = rateCardSnapshot.docs[0].data();
        let calculatedRate = null;

        // Calculate rate based on type
        if (rateCard.rateType === 'skid_based' && skidCount > 0) {
            // Find matching skid rate
            const matchingSkidRate = rateCard.skidRates.find(rate => 
                rate.skidCount === skidCount
            );

            if (matchingSkidRate) {
                calculatedRate = {
                    type: 'skid_based',
                    skidCount: matchingSkidRate.skidCount,
                    price: matchingSkidRate.price,
                    currency: rateCard.currency,
                    notes: matchingSkidRate.notes
                };
            }
        } else if (rateCard.rateType === 'weight_based' && totalWeight > 0) {
            // Find matching weight rate
            const matchingWeightRate = rateCard.weightRates.find(rate => 
                totalWeight >= rate.minWeight && totalWeight <= rate.maxWeight
            );

            if (matchingWeightRate) {
                const calculatedPrice = Math.max(
                    totalWeight * matchingWeightRate.pricePerLb,
                    matchingWeightRate.minimumCharge
                );

                calculatedRate = {
                    type: 'weight_based',
                    totalWeight,
                    pricePerLb: matchingWeightRate.pricePerLb,
                    minimumCharge: matchingWeightRate.minimumCharge,
                    calculatedPrice,
                    currency: rateCard.currency,
                    notes: matchingWeightRate.notes
                };
            }
        }

        if (calculatedRate) {
            logger.info('✅ Enhanced rate calculated', {
                carrierId,
                routeId,
                service,
                serviceType,
                calculatedRate
            });

            return {
                success: true,
                rate: calculatedRate,
                rateCard: {
                    id: rateCardSnapshot.docs[0].id,
                    routeDescription: rateCard.routeDescription,
                    service,
                    serviceType,
                    rateType: rateCard.rateType
                }
            };
        } else {
            return {
                success: false,
                message: 'No matching rate found for the given parameters',
                rate: null
            };
        }

    } catch (error) {
        logger.error('❌ Error calculating enhanced rates', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: error.message,
            rate: null
        };
    }
});

/**
 * Bulk import enhanced rate cards from CSV
 */
exports.bulkImportEnhancedRateCards = onCall(async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { carrierId, csvData, preview = false } = request.data;

        if (!carrierId || !csvData) {
            throw new Error('Carrier ID and CSV data are required');
        }

        logger.info('📥 Bulk importing enhanced rate cards', {
            carrierId,
            preview,
            userId: request.auth.uid
        });

        // Parse CSV data (assuming it's already parsed into array of objects)
        const rateCards = csvData;
        const results = {
            success: 0,
            errors: [],
            preview: []
        };

        for (const rateCardData of rateCards) {
            try {
                // Validate required fields
                const requiredFields = ['routeId', 'service', 'serviceType', 'rateType'];
                for (const field of requiredFields) {
                    if (!rateCardData[field]) {
                        throw new Error(`Missing required field: ${field}`);
                    }
                }

                if (preview) {
                    results.preview.push({
                        ...rateCardData,
                        status: 'valid'
                    });
                } else {
                    // Create rate card
                    const createResult = await exports.createEnhancedRateCard({
                        data: {
                            carrierId,
                            ...rateCardData
                        },
                        auth: request.auth
                    });

                    if (createResult.success) {
                        results.success++;
                    } else {
                        results.errors.push({
                            data: rateCardData,
                            error: createResult.error
                        });
                    }
                }
            } catch (error) {
                results.errors.push({
                    data: rateCardData,
                    error: error.message
                });
            }
        }

        logger.info('✅ Bulk import completed', {
            carrierId,
            success: results.success,
            errors: results.errors.length,
            preview: results.preview.length
        });

        return {
            success: true,
            results,
            message: preview 
                ? `Preview: ${results.preview.length} valid rate cards`
                : `Import completed: ${results.success} successful, ${results.errors.length} errors`
        };

    } catch (error) {
        logger.error('❌ Error in bulk import', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            error: error.message
        };
    }
});
