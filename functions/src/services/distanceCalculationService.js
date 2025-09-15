/**
 * Distance Calculation Service
 * Uses Google Maps Distance Matrix API to calculate distances and travel times between locations
 */

const { logger } = require('firebase-functions/v2');
const axios = require('axios');
const admin = require('firebase-admin');

class DistanceCalculationService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
    }

    /**
     * Fetch Google Maps API key from Firestore
     */
    async getApiKey() {
        if (this.apiKey) {
            return this.apiKey;
        }

        try {
            const db = admin.firestore();
            const keysSnapshot = await db.collection('keys').get();
            
            if (!keysSnapshot.empty) {
                const firstDoc = keysSnapshot.docs[0];
                const key = firstDoc.data().googleAPI;
                if (key) {
                    this.apiKey = key;
                    logger.info('✅ Google Maps API key loaded from Firestore');
                    return key;
                }
            }
            
            throw new Error('Google Maps API key not found in Firestore');
        } catch (error) {
            logger.error('❌ Failed to fetch Google Maps API key:', error.message);
            throw error;
        }
    }

    /**
     * Calculate distances between multiple origins and destinations
     * @param {Array} origins - Array of location objects with {city, province, country}
     * @param {Array} destinations - Array of location objects with {city, province, country}
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Distance matrix results
     */
    async calculateDistanceMatrix(origins, destinations, options = {}) {
        const apiKey = await this.getApiKey();

        if (!origins || !destinations || origins.length === 0 || destinations.length === 0) {
            throw new Error('Origins and destinations are required');
        }

        // Convert locations to address strings
        const originAddresses = origins.map(loc => this.formatLocationAddress(loc));
        const destinationAddresses = destinations.map(loc => this.formatLocationAddress(loc));

        const params = {
            origins: originAddresses.join('|'),
            destinations: destinationAddresses.join('|'),
            key: apiKey,
            units: options.units || 'metric', // metric or imperial
            mode: options.mode || 'driving', // driving, walking, bicycling, transit
            avoid: options.avoid || undefined, // tolls, highways, ferries, indoor
            language: options.language || 'en',
            region: options.region || 'ca' // Bias towards Canadian results
        };

        try {
            logger.info('🗺️ Calculating distance matrix', {
                originsCount: origins.length,
                destinationsCount: destinations.length,
                totalCalculations: origins.length * destinations.length
            });

            const response = await axios.get(this.baseUrl, { params });
            
            if (response.data.status !== 'OK') {
                logger.error('Google Maps API error:', response.data.status, response.data.error_message);
                throw new Error(`Google Maps API error: ${response.data.status}`);
            }

            // Process and format the results
            const processedResults = this.processDistanceMatrixResponse(
                response.data, 
                origins, 
                destinations
            );

            logger.info('✅ Distance matrix calculated successfully', {
                totalRoutes: processedResults.routes.length,
                validRoutes: processedResults.routes.filter(r => r.status === 'OK').length
            });

            return processedResults;

        } catch (error) {
            logger.error('❌ Error calculating distance matrix:', error.message);
            throw error;
        }
    }

    /**
     * Calculate distance for a single origin-destination pair
     * @param {Object} origin - Origin location
     * @param {Object} destination - Destination location
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Distance calculation result
     */
    async calculateSingleDistance(origin, destination, options = {}) {
        const results = await this.calculateDistanceMatrix([origin], [destination], options);
        return results.routes[0] || null;
    }

    /**
     * Format location object to address string for Google Maps API
     * @param {Object} location - Location object
     * @returns {string} Formatted address
     */
    formatLocationAddress(location) {
        const parts = [];
        
        if (location.city) parts.push(location.city);
        if (location.province || location.provinceState) parts.push(location.province || location.provinceState);
        if (location.country) parts.push(location.country);
        
        return parts.join(', ');
    }

    /**
     * Process Google Maps Distance Matrix API response
     * @param {Object} response - Raw API response
     * @param {Array} origins - Original origins array
     * @param {Array} destinations - Original destinations array
     * @returns {Object} Processed results
     */
    processDistanceMatrixResponse(response, origins, destinations) {
        const routes = [];
        const summary = {
            totalRoutes: 0,
            validRoutes: 0,
            errorRoutes: 0,
            totalDistance: { km: 0, miles: 0 },
            totalDuration: 0
        };

        response.rows.forEach((row, originIndex) => {
            row.elements.forEach((element, destIndex) => {
                const route = {
                    id: `route_${originIndex}_${destIndex}`,
                    origin: {
                        ...origins[originIndex],
                        address: response.origin_addresses[originIndex]
                    },
                    destination: {
                        ...destinations[destIndex],
                        address: response.destination_addresses[destIndex]
                    },
                    status: element.status
                };

                summary.totalRoutes++;

                if (element.status === 'OK') {
                    // Extract distance and duration
                    route.distance = {
                        km: Math.round(element.distance.value / 1000 * 100) / 100, // Convert to km with 2 decimals
                        miles: Math.round(element.distance.value / 1609.344 * 100) / 100, // Convert to miles with 2 decimals
                        text: element.distance.text,
                        value: element.distance.value // meters
                    };

                    route.duration = {
                        minutes: Math.round(element.duration.value / 60),
                        hours: Math.round(element.duration.value / 3600 * 100) / 100,
                        text: element.duration.text,
                        value: element.duration.value // seconds
                    };

                    // Add to summary
                    summary.validRoutes++;
                    summary.totalDistance.km += route.distance.km;
                    summary.totalDistance.miles += route.distance.miles;
                    summary.totalDuration += route.duration.minutes;
                } else {
                    // Handle errors
                    route.error = element.status;
                    summary.errorRoutes++;
                    
                    logger.warn('Route calculation failed', {
                        origin: route.origin.address,
                        destination: route.destination.address,
                        status: element.status
                    });
                }

                routes.push(route);
            });
        });

        return {
            routes,
            summary,
            apiResponse: {
                status: response.status,
                originAddresses: response.origin_addresses,
                destinationAddresses: response.destination_addresses
            },
            calculatedAt: new Date().toISOString()
        };
    }

    /**
     * Batch process large route calculations to avoid API limits
     * @param {Array} origins - Origins array
     * @param {Array} destinations - Destinations array
     * @param {Object} options - Options
     * @returns {Promise<Object>} Combined results
     */
    async calculateLargeDistanceMatrix(origins, destinations, options = {}) {
        const maxElementsPerRequest = 100; // Google Maps API limit
        const batchSize = Math.floor(Math.sqrt(maxElementsPerRequest));
        
        logger.info('🔄 Processing large distance matrix in batches', {
            totalOrigins: origins.length,
            totalDestinations: destinations.length,
            totalCalculations: origins.length * destinations.length,
            batchSize
        });

        const allRoutes = [];
        let totalValidRoutes = 0;
        let totalErrorRoutes = 0;

        // Process in batches
        for (let i = 0; i < origins.length; i += batchSize) {
            for (let j = 0; j < destinations.length; j += batchSize) {
                const originBatch = origins.slice(i, i + batchSize);
                const destinationBatch = destinations.slice(j, j + batchSize);

                try {
                    const batchResult = await this.calculateDistanceMatrix(
                        originBatch, 
                        destinationBatch, 
                        options
                    );

                    allRoutes.push(...batchResult.routes);
                    totalValidRoutes += batchResult.summary.validRoutes;
                    totalErrorRoutes += batchResult.summary.errorRoutes;

                    // Add delay between batches to respect rate limits
                    if (i + batchSize < origins.length || j + batchSize < destinations.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    logger.error('Batch calculation failed', {
                        originBatch: originBatch.length,
                        destinationBatch: destinationBatch.length,
                        error: error.message
                    });
                    // Continue with other batches
                }
            }
        }

        // Calculate combined summary
        const combinedSummary = {
            totalRoutes: allRoutes.length,
            validRoutes: totalValidRoutes,
            errorRoutes: totalErrorRoutes,
            totalDistance: {
                km: allRoutes.reduce((sum, route) => sum + (route.distance?.km || 0), 0),
                miles: allRoutes.reduce((sum, route) => sum + (route.distance?.miles || 0), 0)
            },
            totalDuration: allRoutes.reduce((sum, route) => sum + (route.duration?.minutes || 0), 0)
        };

        return {
            routes: allRoutes,
            summary: combinedSummary,
            calculatedAt: new Date().toISOString(),
            batchProcessed: true
        };
    }
}

module.exports = DistanceCalculationService;
