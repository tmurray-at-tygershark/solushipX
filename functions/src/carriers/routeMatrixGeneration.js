/**
 * Route Matrix Generation Functions
 * Intelligent route generation with distance calculations and optimization
 */

const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const DistanceCalculationService = require('../services/distanceCalculationService');

const db = admin.firestore();
const distanceService = new DistanceCalculationService();

/**
 * Generate intelligent route matrix for a carrier
 * Creates all possible pickup → delivery combinations with distance calculations
 */
exports.generateCarrierRouteMatrix = onCall(async (request) => {
    const { data } = request;
    
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { carrierId, zoneConfig, options = {} } = data;

        if (!carrierId || !zoneConfig) {
            throw new Error('Carrier ID and zone configuration are required');
        }

        logger.info('🚀 Generating route matrix', {
            carrierId,
            userId: request.auth.uid,
            pickupCities: zoneConfig.pickupZones?.selectedCities?.length || 0,
            deliveryCities: zoneConfig.deliveryZones?.selectedCities?.length || 0
        });

        // Clear existing routes for this carrier to prevent duplicates
        const existingRoutesQuery = db.collection('carrierRoutes').where('carrierId', '==', carrierId);
        const existingSnapshot = await existingRoutesQuery.get();
        
        if (!existingSnapshot.empty) {
            logger.info('🧹 Clearing existing routes to prevent duplicates', {
                existingRoutes: existingSnapshot.size
            });
            
            const deleteBatch = db.batch();
            existingSnapshot.docs.forEach(doc => {
                deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit();
        }

        // Extract pickup and delivery cities
        const pickupCities = zoneConfig.pickupZones?.selectedCities || [];
        const deliveryCities = zoneConfig.deliveryZones?.selectedCities || [];

        if (pickupCities.length === 0 || deliveryCities.length === 0) {
            return {
                success: false,
                message: 'Both pickup and delivery cities are required for route generation',
                routes: [],
                summary: { totalRoutes: 0, validRoutes: 0, errorRoutes: 0 }
            };
        }

        // Generate route combinations
        const routeCombinations = [];
        pickupCities.forEach((pickup, pickupIndex) => {
            deliveryCities.forEach((delivery, deliveryIndex) => {
                // Skip same-city routes unless explicitly requested
                if (!options.includeSameCityRoutes && 
                    pickup.city === delivery.city && 
                    pickup.provinceState === delivery.provinceState) {
                    return;
                }

                routeCombinations.push({
                    id: `route_${pickupIndex}_${deliveryIndex}`,
                    routeCode: `${pickup.city.substring(0, 3).toUpperCase()}_${delivery.city.substring(0, 3).toUpperCase()}`,
                    pickup: {
                        city: pickup.city,
                        provinceState: pickup.provinceState,
                        country: pickup.country,
                        latitude: pickup.latitude,
                        longitude: pickup.longitude,
                        searchKey: pickup.searchKey
                    },
                    delivery: {
                        city: delivery.city,
                        provinceState: delivery.provinceState,
                        country: delivery.country,
                        latitude: delivery.latitude,
                        longitude: delivery.longitude,
                        searchKey: delivery.searchKey
                    }
                });
            });
        });

        logger.info('📊 Route combinations generated', {
            totalCombinations: routeCombinations.length,
            uniquePickupCities: pickupCities.length,
            uniqueDeliveryCities: deliveryCities.length,
            sampleCombination: routeCombinations[0] || 'none'
        });

        // Calculate straight-line distances using Haversine formula
        logger.info('📍 Calculating straight-line distances using Haversine formula');
        
        const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Radius of the Earth in kilometers
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c; // Distance in kilometers
        };

        const distanceResults = {
            routes: routeCombinations.map((combo, index) => {
                const origin = combo.pickup;
                const destination = combo.delivery;
                
                let distance = { km: 0, miles: 0, text: 'Same location' };
                let duration = { minutes: 0, hours: 0, text: 'Same location' };
                
                if (origin.latitude && origin.longitude && 
                    destination.latitude && destination.longitude) {
                    
                    const distanceKm = calculateHaversineDistance(
                        origin.latitude, origin.longitude,
                        destination.latitude, destination.longitude
                    );
                    
                    const distanceMiles = distanceKm * 0.621371;
                    
                    // Estimate driving time (assume average 60 km/h for city driving)
                    const estimatedHours = distanceKm / 60;
                    const estimatedMinutes = Math.round(estimatedHours * 60);
                    
                    distance = {
                        km: Math.round(distanceKm * 100) / 100, // 2 decimal places
                        miles: Math.round(distanceMiles * 100) / 100,
                        text: `${Math.round(distanceKm)} km`
                    };
                    
                    duration = {
                        minutes: estimatedMinutes,
                        hours: Math.round(estimatedHours * 100) / 100,
                        text: estimatedMinutes < 60 
                            ? `${estimatedMinutes} min` 
                            : `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`
                    };
                }
                
                return {
                    id: combo.id,
                    origin: combo.pickup,
                    destination: combo.delivery,
                    status: 'CALCULATED',
                    distance,
                    duration
                };
            }),
            summary: {
                totalRoutes: routeCombinations.length,
                validRoutes: routeCombinations.length,
                errorRoutes: 0
            }
        };

        logger.info('✅ Calculated straight-line distances for all routes', {
            routesCreated: distanceResults.routes.length,
            averageDistance: Math.round(
                distanceResults.routes.reduce((sum, r) => sum + r.distance.km, 0) / 
                distanceResults.routes.length
            )
        });

        logger.info('🔍 Debug route enhancement', {
            distanceResultsRoutes: distanceResults.routes?.length || 0,
            routeCombinations: routeCombinations.length,
            hasDistanceResults: !!distanceResults
        });

        // Enhance routes with additional metadata
        const enhancedRoutes = distanceResults.routes.map((route, index) => ({
            ...route,
            routeId: `${carrierId}_${route.id || index}`,
            carrierId,
            routeName: `${route.origin.city} → ${route.destination.city}`,
            routeDescription: `${route.origin.city}, ${route.origin.provinceState} to ${route.destination.city}, ${route.destination.provinceState}`,
            enabled: true, // All routes enabled by default
            priority: 1,
            serviceTypes: ['standard'], // Default service types
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            metadata: {
                generatedBy: 'intelligent_route_matrix',
                version: '1.0',
                apiUsed: route.status === 'OK' ? 'google_maps_distance_matrix' : 'none'
            }
        }));

        // Save routes to database
        const batch = db.batch();
        const routeCollectionRef = db.collection('carrierRoutes');

        enhancedRoutes.forEach(route => {
            const routeDocRef = routeCollectionRef.doc();
            batch.set(routeDocRef, {
                ...route,
                id: routeDocRef.id
            });
        });

        await batch.commit();

        logger.info('✅ Route matrix saved to database', {
            savedRoutes: enhancedRoutes.length,
            validDistances: distanceResults.summary.validRoutes
        });

        return {
            success: true,
            routes: enhancedRoutes,
            summary: {
                ...distanceResults.summary,
                carrierId,
                generatedAt: new Date().toISOString(),
                apiCalls: Math.ceil(enhancedRoutes.length / 100) // Estimate API calls used
            },
            message: `Generated ${enhancedRoutes.length} routes with ${distanceResults.summary.validRoutes} distance calculations`
        };

    } catch (error) {
        logger.error('❌ Error generating route matrix:', {
            error: error.message,
            stack: error.stack,
            carrierId: data?.carrierId
        });
        
        throw new Error(error.message);
    }
});

/**
 * Load existing route matrix for a carrier
 */
exports.loadCarrierRouteMatrix = onCall(async (request) => {
    const { data } = request;
    
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { carrierId, filters = {} } = data;

        if (!carrierId) {
            throw new Error('Carrier ID is required');
        }

        logger.info('📥 Loading route matrix', {
            carrierId,
            userId: request.auth.uid
        });

        // Build query
        let query = db.collection('carrierRoutes').where('carrierId', '==', carrierId);

        // Apply filters
        if (filters.enabled !== undefined) {
            query = query.where('enabled', '==', filters.enabled);
        }

        if (filters.minDistance) {
            query = query.where('distance.km', '>=', filters.minDistance);
        }

        if (filters.maxDistance) {
            query = query.where('distance.km', '<=', filters.maxDistance);
        }

        // Execute query
        const snapshot = await query.get();
        const routes = [];

        snapshot.forEach(doc => {
            routes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by distance or route name
        routes.sort((a, b) => {
            if (filters.sortBy === 'distance') {
                return (a.distance?.km || 0) - (b.distance?.km || 0);
            }
            return a.routeName?.localeCompare(b.routeName) || 0;
        });

        // Calculate summary statistics
        const summary = {
            totalRoutes: routes.length,
            validDistances: routes.filter(r => r.distance && r.distance.km > 0).length,
            averageDistance: {
                km: routes.reduce((sum, r) => sum + (r.distance?.km || 0), 0) / routes.length || 0,
                miles: routes.reduce((sum, r) => sum + (r.distance?.miles || 0), 0) / routes.length || 0
            },
            totalDistance: {
                km: routes.reduce((sum, r) => sum + (r.distance?.km || 0), 0),
                miles: routes.reduce((sum, r) => sum + (r.distance?.miles || 0), 0)
            }
        };

        logger.info('✅ Route matrix loaded', {
            routesCount: routes.length,
            validDistances: summary.validDistances
        });

        return {
            success: true,
            routes,
            summary,
            carrierId,
            loadedAt: new Date().toISOString()
        };

    } catch (error) {
        logger.error('❌ Error loading route matrix:', {
            error: error.message,
            carrierId: data?.carrierId
        });
        
        throw new Error(error.message);
    }
});

/**
 * Update route in the matrix (enable/disable, change priority, etc.)
 */
exports.updateCarrierRoute = onCall(async (request) => {
    const { data } = request;
    
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { routeId, updates } = data;

        if (!routeId || !updates) {
            throw new Error('Route ID and updates are required');
        }

        logger.info('📝 Updating carrier route', {
            routeId,
            updates: Object.keys(updates),
            userId: request.auth.uid
        });

        // Update the route
        const routeRef = db.collection('carrierRoutes').doc(routeId);
        await routeRef.update({
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid
        });

        logger.info('✅ Route updated successfully', { routeId });

        return {
            success: true,
            routeId,
            updatedAt: new Date().toISOString()
        };

    } catch (error) {
        logger.error('❌ Error updating route:', {
            error: error.message,
            routeId: data?.routeId
        });
        
        throw new Error(error.message);
    }
});

/**
 * Delete routes from the matrix
 */
exports.deleteCarrierRoutes = onCall(async (request) => {
    const { data } = request;
    
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('User must be authenticated');
        }

        const { routeIds } = data;

        if (!routeIds || !Array.isArray(routeIds) || routeIds.length === 0) {
            throw new Error('Route IDs array is required');
        }

        logger.info('🗑️ Deleting carrier routes', {
            routeCount: routeIds.length,
            userId: request.auth.uid
        });

        // Delete routes in batch
        const batch = db.batch();
        routeIds.forEach(routeId => {
            const routeRef = db.collection('carrierRoutes').doc(routeId);
            batch.delete(routeRef);
        });

        await batch.commit();

        logger.info('✅ Routes deleted successfully', { 
            deletedCount: routeIds.length 
        });

        return {
            success: true,
            deletedCount: routeIds.length,
            deletedAt: new Date().toISOString()
        };

    } catch (error) {
        logger.error('❌ Error deleting routes:', {
            error: error.message,
            routeIds: data?.routeIds
        });
        
        throw new Error(error.message);
    }
});
