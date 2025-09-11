/**
 * Comprehensive North American Shipping Zone Import System
 * Enterprise-level implementation with 600+ zones covering every shipping destination
 * Zero gaps, complete coverage, intelligent city matching
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Import comprehensive zone data from external files
const { CANADIAN_ZONES } = require('./zones-canada');
const { CANADIAN_ZONES_CONTINUED } = require('./zones-canada-continued');
const { USA_MAJOR_METRO_ZONES } = require('./zones-usa-major-metros');
const { USA_STATE_BY_STATE_ZONES } = require('./zones-usa-state-by-state');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// Combine all zone data into one comprehensive array
const ALL_COMPREHENSIVE_ZONES = [
    ...CANADIAN_ZONES,
    ...CANADIAN_ZONES_CONTINUED,
    ...USA_MAJOR_METRO_ZONES,
    ...USA_STATE_BY_STATE_ZONES
];

console.log(`🌍 Loaded ${ALL_COMPREHENSIVE_ZONES.length} comprehensive shipping zones`);

/**
 * Advanced City Matching Algorithm
 * Multi-tier matching with fuzzy logic and geographic validation
 */
async function findMatchingCities(zoneData) {
    const matches = [];
    
    try {
        // Tier 1: Coordinate-based matching (most accurate)
        let coordinateMatches = [];
        if (zoneData.latitude && zoneData.longitude && zoneData.searchRadius) {
            coordinateMatches = await findCitiesByCoordinates(
                zoneData.latitude,
                zoneData.longitude,
                zoneData.searchRadius,
                zoneData.countryCode,
                zoneData.stateProvinceCode
            );
            matches.push(...coordinateMatches);
        }
        
        // Tier 2: Postal code matching
        let postalMatches = [];
        if (zoneData.postalCodes && zoneData.postalCodes.length > 0) {
            postalMatches = await findCitiesByPostalCodes(
                zoneData.postalCodes,
                zoneData.countryCode,
                zoneData.stateProvinceCode
            );
            matches.push(...postalMatches);
        }
        
        // Tier 3: City name + geographic context
        const nameMatches = await findCitiesByName(
            zoneData.city,
            zoneData.cityVariations,
            zoneData.countryCode,
            zoneData.stateProvinceCode
        );
        matches.push(...nameMatches);
        
        // Deduplicate matches
        const uniqueMatches = deduplicateMatches(matches);
        
        return {
            matches: uniqueMatches,
            matchCount: uniqueMatches.length,
            matchTypes: {
                coordinate: coordinateMatches?.length || 0,
                postal: postalMatches?.length || 0,
                name: nameMatches?.length || 0
            }
        };
        
    } catch (error) {
        console.error('❌ City matching error:', error);
        return {
            matches: [],
            matchCount: 0,
            error: error.message
        };
    }
}

/**
 * Find cities within radius of coordinates using bounding box optimization
 */
async function findCitiesByCoordinates(lat, lng, radius, countryCode, stateCode) {
    // Calculate bounding box for efficient querying
    const latDelta = radius / 111000; // Rough conversion: 1 degree = 111km
    const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;
    
    // Query with geographic bounds
    const query = db.collection('geoLocations')
        .where('country', '==', countryCode)
        .where('provinceState', '==', stateCode)
        .where('latitude', '>=', minLat)
        .where('latitude', '<=', maxLat);
        
    const snapshot = await query.get();
    
    const matches = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Additional longitude filter (Firestore limitation workaround)
        if (data.longitude >= minLng && data.longitude <= maxLng) {
            const distance = calculateDistance(lat, lng, data.latitude, data.longitude);
            
            if (distance <= radius) {
                matches.push({
                    ...data,
                    docId: doc.id,
                    distance: Math.round(distance),
                    matchType: 'coordinate'
                });
            }
        }
    });
    
    return matches;
}

/**
 * Find cities by postal codes with intelligent prefix matching
 */
async function findCitiesByPostalCodes(postalCodes, countryCode, stateCode) {
    const matches = [];
    
    for (const postal of postalCodes) {
        try {
            // For Canadian postal codes (3 character FSA)
            if (countryCode === 'CA') {
                const query = db.collection('geoLocations')
                    .where('country', '==', 'CA')
                    .where('provinceState', '==', stateCode)
                    .where('postalZipCode', '>=', postal)
                    .where('postalZipCode', '<', postal + 'Z')
                    .limit(200);
                    
                const snapshot = await query.get();
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.postalZipCode && data.postalZipCode.startsWith(postal)) {
                        matches.push({
                            ...data,
                            docId: doc.id,
                            matchType: 'postal',
                            matchedPostal: postal
                        });
                    }
                });
            }
            // For US ZIP codes (3 digit ZIP3)
            else if (countryCode === 'US') {
                const zipStart = postal.padEnd(5, '0');
                const zipEnd = postal.padEnd(5, '9');
                
                const query = db.collection('geoLocations')
                    .where('country', '==', 'US')
                    .where('provinceState', '==', stateCode)
                    .where('postalZipCode', '>=', zipStart)
                    .where('postalZipCode', '<=', zipEnd)
                    .limit(200);
                    
                const snapshot = await query.get();
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.postalZipCode && data.postalZipCode.startsWith(postal)) {
                        matches.push({
                            ...data,
                            docId: doc.id,
                            matchType: 'postal',
                            matchedPostal: postal
                        });
                    }
                });
            }
        } catch (error) {
            console.error(`❌ Postal code search error for ${postal}:`, error);
        }
    }
    
    return matches;
}

/**
 * Find cities by name and variations with fuzzy matching
 */
async function findCitiesByName(primaryCity, cityVariations, countryCode, stateCode) {
    const matches = [];
    const searchNames = [primaryCity, ...(cityVariations || [])];
    
    for (const cityName of searchNames) {
        try {
            // Exact match
            const exactQuery = db.collection('geoLocations')
                .where('country', '==', countryCode)
                .where('provinceState', '==', stateCode)
                .where('city', '==', cityName)
                .limit(100);
                
            const exactSnapshot = await exactQuery.get();
            exactSnapshot.docs.forEach(doc => {
                matches.push({
                    ...doc.data(),
                    docId: doc.id,
                    matchType: 'name_exact',
                    matchedName: cityName
                });
            });
            
            // Case-insensitive search
            const lowerQuery = db.collection('geoLocations')
                .where('country', '==', countryCode)
                .where('provinceState', '==', stateCode)
                .where('city', '>=', cityName.toLowerCase())
                .where('city', '<', cityName.toLowerCase() + '\uf8ff')
                .limit(50);
                
            const lowerSnapshot = await lowerQuery.get();
            lowerSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.city && data.city.toLowerCase() === cityName.toLowerCase()) {
                    matches.push({
                        ...data,
                        docId: doc.id,
                        matchType: 'name_case_insensitive',
                        matchedName: cityName
                    });
                }
            });

            // Title case search
            const titleCase = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
            if (titleCase !== cityName) {
                const titleQuery = db.collection('geoLocations')
                    .where('country', '==', countryCode)
                    .where('provinceState', '==', stateCode)
                    .where('city', '==', titleCase)
                    .limit(50);
                    
                const titleSnapshot = await titleQuery.get();
                titleSnapshot.docs.forEach(doc => {
                    matches.push({
                        ...doc.data(),
                        docId: doc.id,
                        matchType: 'name_title_case',
                        matchedName: cityName
                    });
                });
            }
            
        } catch (error) {
            console.error(`❌ Name search error for ${cityName}:`, error);
        }
    }
    
    return matches;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Remove duplicate matches using multiple criteria
 */
function deduplicateMatches(matches) {
    const seen = new Set();
    const uniqueMatches = [];
    
    matches.forEach(match => {
        // Create unique key using multiple identifiers
        const key = `${match.city}-${match.provinceState}-${match.postalZipCode}-${match.latitude}-${match.longitude}`;
        
        if (!seen.has(key)) {
            seen.add(key);
            uniqueMatches.push(match);
        }
    });
    
    return uniqueMatches;
}

/**
 * MAIN CLOUD FUNCTION: Import Comprehensive Zones
 * Enterprise-level zone import with intelligent city matching
 */
exports.importComprehensiveZones = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540, // 9 minutes
        memory: '2GB'
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

            const userDoc = await db.collection('users').doc(context.auth.uid).get();
            const userData = userDoc.data();
            
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            logger.info('🚀 Starting Comprehensive Zone Import', {
                userId: context.auth.uid,
                userRole: userData.role,
                totalZones: ALL_COMPREHENSIVE_ZONES.length,
                breakdown: {
                    canadian: CANADIAN_ZONES.length + CANADIAN_ZONES_CONTINUED.length,
                    usa_metros: USA_MAJOR_METRO_ZONES.length,
                    usa_states: USA_STATE_BY_STATE_ZONES.length
                }
            });

            const startTime = Date.now();
            const results = {
                totalZones: ALL_COMPREHENSIVE_ZONES.length,
                processedZones: 0,
                successfulZones: 0,
                failedZones: 0,
                totalCitiesMatched: 0,
                matchingReport: {
                    coordinateMatches: 0,
                    postalMatches: 0,
                    nameMatches: 0,
                    noMatches: 0,
                    perfectMatches: 0, // zones with all match types
                    partialMatches: 0  // zones with some matches
                },
                errors: [],
                zoneDetails: [],
                performance: {
                    averageProcessingTime: 0,
                    slowestZone: null,
                    fastestZone: null
                }
            };

            // Clear existing zones if requested
            if (data.clearExisting) {
                logger.info('🗑️ Clearing existing zones...');
                
                const collections = ['zones', 'zoneCities', 'zonePostalCodes'];
                let totalCleared = 0;
                
                for (const collectionName of collections) {
                    const existingDocs = await db.collection(collectionName).get();
                    
                    if (existingDocs.size > 0) {
                        const batches = [];
                        let batch = db.batch();
                        let batchCount = 0;

                        existingDocs.forEach(doc => {
                            batch.delete(doc.ref);
                            batchCount++;
                            if (batchCount >= 450) {
                                batches.push(batch);
                                batch = db.batch();
                                batchCount = 0;
                            }
                        });

                        if (batchCount > 0) {
                            batches.push(batch);
                        }

                        for (const batchItem of batches) {
                            await batchItem.commit();
                        }
                        
                        totalCleared += existingDocs.size;
                        logger.info(`🗑️ Cleared ${existingDocs.size} documents from ${collectionName}`);
                    }
                }

                logger.info(`🗑️ Total cleared: ${totalCleared} documents across all collections`);
            }

            // Process zones in optimized batches
            const batchSize = 8; // Reduced for better memory management
            const totalBatches = Math.ceil(ALL_COMPREHENSIVE_ZONES.length / batchSize);
            
            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const startIdx = batchIndex * batchSize;
                const endIdx = Math.min(startIdx + batchSize, ALL_COMPREHENSIVE_ZONES.length);
                const zoneBatch = ALL_COMPREHENSIVE_ZONES.slice(startIdx, endIdx);
                
                logger.info(`📊 Processing batch ${batchIndex + 1}/${totalBatches} (zones ${startIdx + 1}-${endIdx})`);
                
                await Promise.all(zoneBatch.map(async (zoneData) => {
                    const zoneStartTime = Date.now();
                    
                    try {
                        results.processedZones++;
                        
                        logger.info(`📍 Processing zone: ${zoneData.zoneName}`, {
                            progress: `${results.processedZones}/${ALL_COMPREHENSIVE_ZONES.length}`,
                            batch: `${batchIndex + 1}/${totalBatches}`
                        });

                        // Find matching cities using advanced algorithm
                        const cityMatches = await findMatchingCities(zoneData);
                        
                        // Determine match quality
                        const hasCoordinateMatch = cityMatches.matchTypes.coordinate > 0;
                        const hasPostalMatch = cityMatches.matchTypes.postal > 0;
                        const hasNameMatch = cityMatches.matchTypes.name > 0;
                        
                        let matchQuality = 'no_match';
                        if (hasCoordinateMatch && hasPostalMatch && hasNameMatch) {
                            matchQuality = 'perfect';
                            results.matchingReport.perfectMatches++;
                        } else if (cityMatches.matchCount > 0) {
                            matchQuality = 'partial';
                            results.matchingReport.partialMatches++;
                        } else {
                            results.matchingReport.noMatches++;
                        }
                        
                        // Create zone document with comprehensive metadata
                        const zoneDoc = {
                            zoneCode: zoneData.zoneId,
                            zoneName: zoneData.zoneName,
                            description: zoneData.notes || '',
                            country: zoneData.country,
                            countryCode: zoneData.countryCode,
                            stateProvince: zoneData.stateProvince,
                            stateProvinceCode: zoneData.stateProvinceCode,
                            zoneType: zoneData.zoneType,
                            primaryCity: zoneData.city,
                            cityVariations: zoneData.cityVariations || [],
                            primaryPostal: zoneData.primaryPostal,
                            definedPostalCodes: zoneData.postalCodes || [],
                            centerLatitude: zoneData.latitude,
                            centerLongitude: zoneData.longitude,
                            searchRadius: zoneData.searchRadius,
                            enabled: true,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            createdBy: context.auth.uid,
                            metadata: {
                                totalCities: cityMatches.matchCount,
                                totalPostalCodes: zoneData.postalCodes?.length || 0,
                                coverage: zoneData.zoneType,
                                matchTypes: cityMatches.matchTypes,
                                matchQuality: matchQuality,
                                importSource: 'comprehensive_import_v2',
                                processingTime: 0 // Will be updated below
                            }
                        };

                        // Save zone to database
                        const zoneRef = await db.collection('zones').add(zoneDoc);
                        
                        // Save zone cities in optimized batches
                        if (cityMatches.matches.length > 0) {
                            const zoneCitiesBatches = [];
                            let zoneCitiesBatch = db.batch();
                            let cityBatchCount = 0;
                            
                            for (const city of cityMatches.matches) {
                                const zoneCityDoc = {
                                    zoneId: zoneRef.id,
                                    zoneCode: zoneData.zoneId,
                                    cityId: city.docId,
                                    city: city.city,
                                    province: city.provinceStateName || city.provinceState,
                                    country: city.countryName || city.country,
                                    primaryPostal: city.postalZipCode,
                                    latitude: city.latitude,
                                    longitude: city.longitude,
                                    distance: city.distance || null,
                                    matchType: city.matchType,
                                    matchedName: city.matchedName || null,
                                    matchedPostal: city.matchedPostal || null,
                                    enabled: true,
                                    addedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    addedBy: context.auth.uid
                                };
                                
                                const zoneCityRef = db.collection('zoneCities').doc();
                                zoneCitiesBatch.set(zoneCityRef, zoneCityDoc);
                                
                                cityBatchCount++;
                                if (cityBatchCount >= 400) {
                                    zoneCitiesBatches.push(zoneCitiesBatch);
                                    zoneCitiesBatch = db.batch();
                                    cityBatchCount = 0;
                                }
                            }
                            
                            if (cityBatchCount > 0) {
                                zoneCitiesBatches.push(zoneCitiesBatch);
                            }
                            
                            // Commit all city batches
                            for (const batch of zoneCitiesBatches) {
                                await batch.commit();
                            }
                        }

                        // Save postal codes in optimized batches
                        if (zoneData.postalCodes && zoneData.postalCodes.length > 0) {
                            const postalBatches = [];
                            let postalBatch = db.batch();
                            let postalBatchCount = 0;
                            
                            for (const postal of zoneData.postalCodes) {
                                const postalDoc = {
                                    zoneId: zoneRef.id,
                                    zoneCode: zoneData.zoneId,
                                    postalCode: postal,
                                    country: zoneData.countryCode,
                                    provinceState: zoneData.stateProvinceCode,
                                    zoneType: zoneData.zoneType,
                                    addedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    addedBy: context.auth.uid
                                };
                                
                                const postalRef = db.collection('zonePostalCodes').doc();
                                postalBatch.set(postalRef, postalDoc);
                                
                                postalBatchCount++;
                                if (postalBatchCount >= 450) {
                                    postalBatches.push(postalBatch);
                                    postalBatch = db.batch();
                                    postalBatchCount = 0;
                                }
                            }
                            
                            if (postalBatchCount > 0) {
                                postalBatches.push(postalBatch);
                            }
                            
                            // Commit all postal batches
                            for (const batch of postalBatches) {
                                await batch.commit();
                            }
                        }

                        // Calculate processing time for this zone
                        const zoneEndTime = Date.now();
                        const zoneProcessingTime = zoneEndTime - zoneStartTime;
                        
                        // Update zone with processing time
                        await zoneRef.update({
                            'metadata.processingTime': zoneProcessingTime
                        });

                        // Update results
                        results.successfulZones++;
                        results.totalCitiesMatched += cityMatches.matchCount;
                        results.matchingReport.coordinateMatches += cityMatches.matchTypes.coordinate;
                        results.matchingReport.postalMatches += cityMatches.matchTypes.postal;
                        results.matchingReport.nameMatches += cityMatches.matchTypes.name;
                        
                        // Track performance
                        if (!results.performance.fastestZone || zoneProcessingTime < results.performance.fastestZone.time) {
                            results.performance.fastestZone = {
                                zone: zoneData.zoneName,
                                time: zoneProcessingTime
                            };
                        }
                        
                        if (!results.performance.slowestZone || zoneProcessingTime > results.performance.slowestZone.time) {
                            results.performance.slowestZone = {
                                zone: zoneData.zoneName,
                                time: zoneProcessingTime
                            };
                        }

                        results.zoneDetails.push({
                            zoneId: zoneData.zoneId,
                            zoneName: zoneData.zoneName,
                            citiesMatched: cityMatches.matchCount,
                            matchTypes: cityMatches.matchTypes,
                            matchQuality: matchQuality,
                            processingTime: zoneProcessingTime,
                            status: 'success'
                        });

                    } catch (error) {
                        results.failedZones++;
                        results.errors.push({
                            zoneId: zoneData.zoneId,
                            zoneName: zoneData.zoneName,
                            error: error.message,
                            stack: error.stack
                        });
                        
                        logger.error(`❌ Failed to process zone: ${zoneData.zoneName}`, error);
                    }
                }));

                // Progress and performance logging
                const progress = Math.round((results.processedZones / ALL_COMPREHENSIVE_ZONES.length) * 100);
                const avgTime = results.zoneDetails.length > 0 ? 
                    results.zoneDetails.reduce((sum, zone) => sum + zone.processingTime, 0) / results.zoneDetails.length : 0;
                    
                logger.info(`📊 Batch ${batchIndex + 1}/${totalBatches} complete - Progress: ${progress}%`, {
                    successful: results.successfulZones,
                    failed: results.failedZones,
                    citiesMatched: results.totalCitiesMatched,
                    avgProcessingTime: `${Math.round(avgTime)}ms`,
                    perfectMatches: results.matchingReport.perfectMatches,
                    partialMatches: results.matchingReport.partialMatches,
                    noMatches: results.matchingReport.noMatches
                });

                // Brief pause between batches to prevent overload
                if (batchIndex < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            const endTime = Date.now();
            const totalDuration = Math.round((endTime - startTime) / 1000);
            
            // Calculate final performance metrics
            results.performance.averageProcessingTime = results.zoneDetails.length > 0 ?
                Math.round(results.zoneDetails.reduce((sum, zone) => sum + zone.processingTime, 0) / results.zoneDetails.length) : 0;

            logger.info('🎉 Comprehensive Zone Import Complete!', {
                duration: `${totalDuration}s`,
                avgZoneTime: `${results.performance.averageProcessingTime}ms`,
                successRate: `${Math.round((results.successfulZones / results.totalZones) * 100)}%`,
                results
            });

            return {
                success: true,
                duration: totalDuration,
                ...results
            };

        } catch (error) {
            logger.error('❌ Comprehensive zone import failed:', error);
            throw new functions.https.HttpsError(
                'internal',
                `Failed to import zones: ${error.message}`
            );
        }
    });

/**
 * Get zones with advanced filtering and search
 */
exports.getZones = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            const {
                searchTerm,
                countryFilter,
                stateProvinceFilter,
                zoneTypeFilter,
                page = 0,
                limit = 50,
                sortBy = 'zoneName',
                sortDirection = 'asc'
            } = data;

            let query = db.collection('zones');

            // Apply filters
            if (countryFilter) {
                query = query.where('countryCode', '==', countryFilter);
            }

            if (stateProvinceFilter) {
                query = query.where('stateProvinceCode', '==', stateProvinceFilter);
            }

            if (zoneTypeFilter) {
                query = query.where('zoneType', '==', zoneTypeFilter);
            }

            // Apply sorting
            query = query.orderBy(sortBy, sortDirection);

            // Get total count for pagination
            const countQuery = await query.count().get();
            const totalCount = countQuery.data().count;

            // Apply pagination
            query = query.offset(page * limit).limit(limit);

            const snapshot = await query.get();
            const zones = [];

            snapshot.docs.forEach(doc => {
                zones.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Apply search filter on results (client-side for complex search)
            let filteredZones = zones;
            if (searchTerm && searchTerm.trim()) {
                const searchLower = searchTerm.toLowerCase();
                filteredZones = zones.filter(zone => 
                    zone.zoneName?.toLowerCase().includes(searchLower) ||
                    zone.zoneCode?.toLowerCase().includes(searchLower) ||
                    zone.primaryCity?.toLowerCase().includes(searchLower) ||
                    zone.description?.toLowerCase().includes(searchLower) ||
                    zone.stateProvince?.toLowerCase().includes(searchLower) ||
                    zone.cityVariations?.some(variation => variation.toLowerCase().includes(searchLower))
                );
            }

            return {
                zones: filteredZones,
                totalCount: searchTerm ? filteredZones.length : totalCount,
                hasMore: !searchTerm && zones.length === limit,
                pagination: {
                    currentPage: page,
                    pageSize: limit,
                    totalPages: Math.ceil(totalCount / limit)
                }
            };

        } catch (error) {
            throw new functions.https.HttpsError(
                'internal',
                `Failed to get zones: ${error.message}`
            );
        }
    });

/**
 * Get cities in a specific zone with detailed information
 */
exports.getZoneCities = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            const { zoneId, includeCoordinates = true, includePostalCodes = true } = data;

            // Get zone cities
            const citiesQuery = db.collection('zoneCities')
                .where('zoneId', '==', zoneId)
                .where('enabled', '==', true)
                .orderBy('city');

            const citiesSnapshot = await citiesQuery.get();
            const cities = [];
            
            citiesSnapshot.docs.forEach(doc => {
                const cityData = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Optional data inclusion based on parameters
                if (!includeCoordinates) {
                    delete cityData.latitude;
                    delete cityData.longitude;
                }
                
                cities.push(cityData);
            });

            // Get postal codes if requested
            let postalCodes = [];
            if (includePostalCodes) {
                const postalQuery = db.collection('zonePostalCodes')
                    .where('zoneId', '==', zoneId)
                    .orderBy('postalCode');
                    
                const postalSnapshot = await postalQuery.get();
                postalSnapshot.docs.forEach(doc => {
                    postalCodes.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
            }

            // Get zone summary
            const zoneDoc = await db.collection('zones').doc(zoneId).get();
            const zoneData = zoneDoc.exists ? zoneDoc.data() : null;

            return {
                zone: zoneData,
                cities,
                postalCodes,
                summary: {
                    totalCities: cities.length,
                    totalPostalCodes: postalCodes.length,
                    coverage: {
                        countries: [...new Set(cities.map(c => c.country))],
                        provinces: [...new Set(cities.map(c => c.province))]
                    }
                }
            };

        } catch (error) {
            throw new functions.https.HttpsError(
                'internal',
                `Failed to get zone cities: ${error.message}`
            );
        }
    });

/**
 * Add a city to an existing zone
 */
exports.addCityToZone = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            const { zoneId, cityData } = data;

            // Validate required fields
            if (!zoneId || !cityData || !cityData.city) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone ID and city data are required'
                );
            }

            // Check if city already exists in zone
            const existingCity = await db.collection('zoneCities')
                .where('zoneId', '==', zoneId)
                .where('city', '==', cityData.city)
                .where('province', '==', cityData.province)
                .get();

            if (!existingCity.empty) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    'City already exists in this zone'
                );
            }

            // Add city to zone
            const zoneCityDoc = {
                zoneId: zoneId,
                cityId: cityData.cityId || null,
                city: cityData.city,
                province: cityData.province,
                country: cityData.country,
                primaryPostal: cityData.primaryPostal || null,
                latitude: cityData.latitude || null,
                longitude: cityData.longitude || null,
                distance: cityData.distance || null,
                matchType: 'manual_add',
                enabled: true,
                addedAt: admin.firestore.FieldValue.serverTimestamp(),
                addedBy: context.auth.uid
            };

            const cityRef = await db.collection('zoneCities').add(zoneCityDoc);

            // Update zone metadata
            const zoneRef = db.collection('zones').doc(zoneId);
            await zoneRef.update({
                'metadata.totalCities': admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                cityId: cityRef.id,
                message: `Added ${cityData.city}, ${cityData.province} to zone`
            };

        } catch (error) {
            throw new functions.https.HttpsError(
                'internal',
                `Failed to add city to zone: ${error.message}`
            );
        }
    });

/**
 * Remove a city from a zone
 */
exports.removeCityFromZone = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            const { zoneCityId } = data;

            if (!zoneCityId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone city ID is required'
                );
            }

            // Get zone city document
            const zoneCityDoc = await db.collection('zoneCities').doc(zoneCityId).get();
            
            if (!zoneCityDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Zone city not found'
                );
            }

            const zoneCityData = zoneCityDoc.data();
            const zoneId = zoneCityData.zoneId;

            // Delete the zone city
            await db.collection('zoneCities').doc(zoneCityId).delete();

            // Update zone metadata
            const zoneRef = db.collection('zones').doc(zoneId);
            await zoneRef.update({
                'metadata.totalCities': admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                message: `Removed ${zoneCityData.city}, ${zoneCityData.province} from zone`
            };

        } catch (error) {
            throw new functions.https.HttpsError(
                'internal',
                `Failed to remove city from zone: ${error.message}`
            );
        }
    });

