/**
 * Custom Carrier Zone Management Cloud Functions
 * Handles CRUD operations for carrier-specific custom zones and zone sets
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
// v2 https callable (for proper CORS handling)
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const v2Logger = require('firebase-functions/logger');

/**
 * Helper function to fetch coordinates for cities from geoLocations collection
 * Uses the same approach as manual search to ensure coordinate consistency
 */
async function fetchCoordinatesForCities(cities, db, logger) {
    const citiesNeedingCoords = cities.filter(city => !city.latitude || !city.longitude);
    
    if (citiesNeedingCoords.length === 0) {
        return cities; // All cities already have coordinates
    }

    logger.info('🔍 Cities need coordinates, searching geoLocations', {
        citiesCount: citiesNeedingCoords.length,
        cityNames: citiesNeedingCoords.map(c => c.city)
    });

    for (const city of citiesNeedingCoords) {
        try {
            // Use same approach as manual search - range query for case-insensitive search
            const capitalizedSearch = city.city.charAt(0).toUpperCase() + city.city.slice(1).toLowerCase();
            const searchEnd = capitalizedSearch.replace(/.$/, c => String.fromCharCode(c.charCodeAt(0) + 1));

            const geoQuery = await db.collection('geoLocations')
                .where('city', '>=', capitalizedSearch)
                .where('city', '<', searchEnd)
                .orderBy('city')
                .limit(100)
                .get();

            logger.info('🔍 GeoLocations search results', {
                cityName: city.city,
                docsFound: geoQuery.size
            });

            if (!geoQuery.empty) {
                // Find best record with coordinates (same prioritization as manual search)
                let bestRecord = null;
                geoQuery.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.city.toLowerCase() === city.city.toLowerCase() &&
                        data.latitude && data.longitude) {
                        if (!bestRecord || (data.latitude && data.longitude)) {
                            bestRecord = data;
                        }
                    }
                });

                if (bestRecord) {
                    // Update the city with coordinates
                    city.latitude = bestRecord.latitude;
                    city.longitude = bestRecord.longitude;
                    city.lat = bestRecord.latitude;
                    city.lng = bestRecord.longitude;

                    logger.info('✅ Updated city with coordinates', {
                        city: city.city,
                        latitude: bestRecord.latitude,
                        longitude: bestRecord.longitude
                    });
                }
            }
        } catch (error) {
            logger.error('❌ Error fetching coordinates for city', {
                city: city.city,
                error: error.message
            });
        }
    }

    return cities;
}

/**
 * Expand system zone to cities (individual zone)
 */
exports.expandSystemZoneToCities = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { zoneId } = data;

            if (!zoneId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone ID is required'
                );
            }

            logger.info('🔄 Expanding system zone to cities', { zoneId });

            const db = admin.firestore();

            // Get zone data first (needed for logging and fallback)
            let zoneData = null;
            try {
                const zoneDoc = await db.collection('zones').doc(zoneId).get();
                if (zoneDoc.exists) {
                    zoneData = zoneDoc.data();
                }
                logger.info('🔍 Zone document loaded', {
                    zoneId,
                    exists: zoneDoc.exists,
                    zoneName: zoneData?.zoneName
                });
            } catch (error) {
                logger.error('❌ Error loading zone document', { zoneId, error: error.message });
            }

            // Get cities from zoneCities collection (same query as EnterpriseZoneManagement)
            const zoneCitiesQuery = await db.collection('zoneCities')
                .where('zoneId', '==', zoneId)
                .get();

            logger.info('🔍 Zone cities found', {
                zoneId,
                docsFound: zoneCitiesQuery.size
            });

            const cities = [];
            
            if (!zoneCitiesQuery.empty) {
                // Process cities from zoneCities collection
                const cityNames = new Set();
                
                zoneCitiesQuery.forEach(doc => {
                    const cityData = doc.data();
                    const cityKey = `${cityData.city}-${cityData.province}-${cityData.country}`;
                    
                    if (!cityNames.has(cityKey)) {
                        cityNames.add(cityKey);
                        
                        // Check if this city has coordinates, if not we'll need to search geoLocations
                        const hasCoordinates = !!(cityData.latitude && cityData.longitude);
                        
                        cities.push({
                            id: cityKey.toLowerCase().replace(/\s+/g, '-'),
                            searchKey: cityKey.toLowerCase().replace(/\s+/g, '-'),
                            city: cityData.city,
                            provinceState: cityData.province,
                            provinceStateName: cityData.province,
                            country: cityData.country,
                            countryName: cityData.country === 'CA' ? 'Canada' : cityData.country === 'US' ? 'United States' : cityData.country,
                            postalZipCode: cityData.primaryPostal,
                            latitude: cityData.latitude,
                            longitude: cityData.longitude,
                            lat: cityData.latitude,
                            lng: cityData.longitude,
                            zoneId: zoneId,
                            zoneCode: cityData.zoneCode || zoneData?.zoneCode || 'N/A', // Get zone code from city data or zone document
                            matchType: cityData.matchType,
                            needsCoordinates: !hasCoordinates // Flag for coordinate lookup
                        });
                    }
                });
            } else {
                // Fallback: Parse zone name and find cities directly
                if (zoneData) {
                    const zoneName = zoneData.zoneName || '';
                    
                    // For "Barrie-Simcoe - Orillia", extract "Barrie" and "Orillia"
                    const cityNames = [];
                    if (zoneName.includes('Barrie')) cityNames.push('Barrie');
                    if (zoneName.includes('Orillia')) cityNames.push('Orillia');
                    
                    // Use the SAME APPROACH as manual city lookup - getLocationsByCity
                    for (const cityName of cityNames) {
                        try {
                            logger.info('🔍 Looking up city with getLocationsByCity approach', { cityName });

                            // EXACT same query as useGeographicData.loadCities() - range query for case-insensitive search
                            // IMPORTANT: Manual search doesn't filter by country when searching by city name
                            const capitalizedSearch = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
                            const searchEnd = capitalizedSearch.replace(/.$/, c => String.fromCharCode(c.charCodeAt(0) + 1));

                            logger.info('🔍 Using EXACT manual search range query (no country filter)', {
                                cityName,
                                capitalizedSearch,
                                searchEnd,
                                zoneCountry: zoneData.country,
                                note: 'Manual search searches ALL countries when no country filter provided'
                            });

                            // Same as manual search - search across ALL countries (no country filter)
                            const locationsQuery = await db.collection('geoLocations')
                                .where('city', '>=', capitalizedSearch)
                                .where('city', '<', searchEnd)
                                .orderBy('city')
                                .limit(100)
                                .get();

                            logger.info('🔍 FIREBASE QUERY RESULTS', {
                                cityName,
                                capitalizedSearch,
                                searchEnd,
                                collection: 'geoLocations',
                                docsFound: locationsQuery.size,
                                queryType: 'range query with city >= and city <'
                            });

                            // Export ALL document IDs found
                            const allDocIds = locationsQuery.docs.map(doc => doc.id);
                            logger.info('📋 ALL DOCUMENT IDs FOUND IN QUERY', {
                                cityName,
                                totalDocs: allDocIds.length,
                                documentIds: allDocIds
                            });

                            if (!locationsQuery.empty) {
                                // EXACT same deduplication logic as useGeographicData.loadCities()
                                const cityMap = new Map();

                                locationsQuery.docs.forEach(doc => {
                                    const data = doc.data();
                                    
                                    // Create multiple city keys to handle both province code and name formats
                                    const cityKeyWithCode = `${data.city}-${data.provinceState}-${data.country}`;
                                    const cityKeyWithName = `${data.city}-${data.provinceStateName}-${data.countryName}`;
                                    
                                    logger.info('📄 COMPLETE FIREBASE DOCUMENT DATA', {
                                        searchingFor: cityName,
                                        docId: doc.id,
                                        fullDocumentData: {
                                            city: data.city,
                                            provinceState: data.provinceState,
                                            provinceStateName: data.provinceStateName,
                                            country: data.country,
                                            countryName: data.countryName,
                                            postalZipCode: data.postalZipCode,
                                            latitude: data.latitude,
                                            longitude: data.longitude,
                                            // Export ALL fields in the document
                                            ...data
                                        },
                                        coordinateStatus: {
                                            hasLatitude: !!data.latitude,
                                            hasLongitude: !!data.longitude,
                                            latitudeValue: data.latitude,
                                            longitudeValue: data.longitude,
                                            latitudeType: typeof data.latitude,
                                            longitudeType: typeof data.longitude
                                        },
                                        cityKeys: {
                                            withCode: cityKeyWithCode,
                                            withName: cityKeyWithName
                                        }
                                    });

                                    // Check both formats for existing records
                                    const existingWithCode = cityMap.get(cityKeyWithCode);
                                    const existingWithName = cityMap.get(cityKeyWithName);
                                    
                                    // EXACT same logic as useGeographicData.loadCities(): prioritize records with coordinates
                                    const shouldAdd = (!existingWithCode && !existingWithName) || 
                                        (data.latitude && data.longitude && 
                                         (!existingWithCode?.latitude && !existingWithName?.latitude));

                                    if (shouldAdd) {
                                        const cityRecord = {
                                            id: doc.id,
                                            city: data.city,
                                            provinceState: data.provinceState, // "ON" 
                                            provinceStateName: data.provinceStateName, // "Ontario"
                                            country: data.country, // "CA"
                                            countryName: data.countryName, // "Canada"
                                            postalCode: data.postalZipCode,
                                            latitude: data.latitude,
                                            longitude: data.longitude,
                                            searchKey: cityKeyWithCode.toLowerCase() // Use code format for consistency
                                        };

                                        // Store under both keys to handle both formats
                                        cityMap.set(cityKeyWithCode, cityRecord);
                                        cityMap.set(cityKeyWithName, cityRecord);

                                        logger.info('✅ CITY RECORD ADDED TO MAP', {
                                            city: data.city,
                                            docId: doc.id,
                                            provinceState: data.provinceState,
                                            country: data.country,
                                            hasCoords: !!(data.latitude && data.longitude),
                                            latitude: data.latitude,
                                            longitude: data.longitude,
                                            bothKeys: [cityKeyWithCode, cityKeyWithName],
                                            finalCityRecord: cityRecord
                                        });
                                    }
                                });

                                // Get unique cities (remove duplicates from storing under both keys)
                                const uniqueCities = new Map();
                                Array.from(cityMap.values()).forEach(cityRecord => {
                                    if (cityRecord.city.toLowerCase() === cityName.toLowerCase()) {
                                        uniqueCities.set(cityRecord.id, cityRecord); // Use doc ID as unique key
                                    }
                                });

                                const allCitiesForThisName = Array.from(uniqueCities.values())
                                    .sort((a, b) => a.city.localeCompare(b.city));

                                logger.info('🎯 FINAL UNIQUE CITIES FOUND FOR ZONE EXPANSION', {
                                    searchingFor: cityName,
                                    uniqueCitiesFound: allCitiesForThisName.length,
                                    cityDetails: allCitiesForThisName.map(city => ({
                                        docId: city.id,
                                        city: city.city,
                                        hasCoords: !!(city.latitude && city.longitude),
                                        latitude: city.latitude,
                                        longitude: city.longitude,
                                        provinceState: city.provinceState,
                                        country: city.country
                                    }))
                                });

                                allCitiesForThisName.forEach(cityRecord => {
                                    const finalCityForReturn = {
                                        ...cityRecord,
                                        zoneId: zoneId,
                                        zoneName: zoneData.zoneName,
                                        zoneCode: zoneData?.zoneCode || 'N/A',
                                        matchType: 'coordinate'
                                    };

                                    cities.push(finalCityForReturn);

                                    logger.info('✅ FINAL CITY ADDED TO RETURN ARRAY', {
                                        city: cityRecord.city,
                                        docId: cityRecord.id,
                                        hasCoords: !!(cityRecord.latitude && cityRecord.longitude),
                                        latitude: cityRecord.latitude,
                                        longitude: cityRecord.longitude,
                                        finalReturnObject: finalCityForReturn
                                    });
                                });
                            } else {
                                logger.warn('⚠️ No location records found for city', { cityName });
                            }
                        } catch (error) {
                            logger.error('❌ Error processing city:', { cityName, error: error.message });
                        }
                    }
                }
            }

            // Fetch coordinates for all cities regardless of source
            const citiesWithCoords = await fetchCoordinatesForCities(cities, db, logger);

            // Use cities with coordinates for final result
            const finalCities = citiesWithCoords;

            logger.info('🏁 ZONE EXPANSION COMPLETE - FINAL RESULT', {
                zoneId,
                zoneName: zoneData?.zoneName,
                totalCities: finalCities.length,
                finalCitiesReturned: finalCities.map(c => ({
                    docId: c.id,
                    city: c.city,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    hasCoords: !!(c.latitude && c.longitude),
                    provinceState: c.provinceState,
                    country: c.country,
                    searchKey: c.searchKey
                })),
                collectionSearched: 'zoneCities + geoLocations',
                searchMethod: 'hybrid approach with coordinate lookup'
            });

            return {
                success: true,
                cities: finalCities,
                zoneId,
                totalCities: finalCities.length
            };

        } catch (error) {
            logger.error('❌ Error expanding zone', {
                zoneId: data.zoneId,
                error: error.message,
                stack: error.stack
            });
            
            throw new functions.https.HttpsError(
                'internal',
                error.message
            );
        }
    });

/**
 * Expand system zone set to cities
 */
exports.expandZoneSetToCities = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { zoneSetId } = data;

            if (!zoneSetId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Zone set ID is required'
                );
            }

            logger.info('🔄 Expanding zone set to cities', { zoneSetId });

            const db = admin.firestore();

            // Get the zone set
            const zoneSetDoc = await db.collection('zoneSets').doc(zoneSetId).get();
            if (!zoneSetDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Zone set not found'
                );
            }

            const zoneSetData = zoneSetDoc.data();
            logger.info('📋 Zone set data', { 
                name: zoneSetData.name,
                selectedZones: zoneSetData.selectedZones?.length || 0,
                fullZoneSetData: zoneSetData
            });

            // Get cities from the selected zones
            const cities = [];
            
            logger.info('🔍 Zone set processing debug', {
                hasSelectedZones: !!zoneSetData.selectedZones,
                selectedZonesLength: zoneSetData.selectedZones?.length || 0,
                selectedZonesData: zoneSetData.selectedZones
            });
            
            if (zoneSetData.selectedZones && zoneSetData.selectedZones.length > 0) {
                // Query cities from the selected zones
                for (const zoneId of zoneSetData.selectedZones) {
                    try {
                        // Get zone data
                        const zoneDoc = await db.collection('zones').doc(zoneId).get();
                        if (!zoneDoc.exists) {
                            logger.warn(`Zone ${zoneId} not found, skipping`);
                            continue;
                        }

                        const zoneData = zoneDoc.data();
                        
                        logger.info('🔍 Processing zone in zone set', {
                            zoneId,
                            zoneName: zoneData.zoneName,
                            zoneCode: zoneData.zoneCode,
                            hasDirectCities: !!(zoneData.cities && Array.isArray(zoneData.cities)),
                            directCitiesCount: zoneData.cities?.length || 0,
                            fullZoneData: zoneData
                        });
                        
                        // Use the same expansion logic as expandSystemZoneToCities
                        // First try to get cities from zoneCities collection
                        const zoneCitiesQuery = await db.collection('zoneCities')
                            .where('zoneId', '==', zoneId)
                            .get();

                        logger.info('🔍 Zone cities query result', {
                            zoneId,
                            zoneName: zoneData.zoneName,
                            citiesFound: zoneCitiesQuery.size,
                            isEmpty: zoneCitiesQuery.empty
                        });

                        if (!zoneCitiesQuery.empty) {
                            // Process cities from zoneCities collection (same as individual zone expansion)
                            const cityNames = new Set();
                            
                            zoneCitiesQuery.forEach(doc => {
                                const cityData = doc.data();
                                const cityKey = `${cityData.city}-${cityData.province}-${cityData.country}`;
                                
                                if (!cityNames.has(cityKey)) {
                                    cityNames.add(cityKey);
                                    
                                    cities.push({
                                        id: cityKey.toLowerCase().replace(/\s+/g, '-'),
                                        searchKey: cityKey.toLowerCase().replace(/\s+/g, '-'),
                                        city: cityData.city,
                                        provinceState: cityData.province,
                                        provinceStateName: cityData.province,
                                        country: cityData.country,
                                        countryName: cityData.country === 'CA' ? 'Canada' : cityData.country === 'US' ? 'United States' : cityData.country,
                                        postalZipCode: cityData.primaryPostal,
                                        latitude: cityData.latitude,
                                        longitude: cityData.longitude,
                                        lat: cityData.latitude,
                                        lng: cityData.longitude,
                                        zoneId: zoneId,
                                        zoneCode: cityData.zoneCode || zoneData?.zoneCode || 'N/A',
                                        matchType: cityData.matchType
                                    });
                                }
                            });
                            
                            logger.info(`✅ Added ${cityNames.size} cities from zone ${zoneId} via zoneCities collection`);
                        } else {
                            logger.warn(`⚠️ No cities found in zoneCities collection for zone ${zoneId}`);
                        }

                    } catch (error) {
                        logger.warn(`Error processing zone ${zoneId}:`, error.message);
                        continue;
                    }
                }
            } else {
                // Fallback: Use geography-based expansion
                const expandedCities = await expandZoneSetByGeography(zoneSetData, db);
                cities.push(...expandedCities);
            }

            // Fetch coordinates for cities that don't have them
            const citiesWithCoordinates = await fetchCoordinatesForCities(cities, db, logger);
            
            // Remove duplicates and format cities
            const uniqueCities = [];
            const seenIds = new Set();

            for (const city of citiesWithCoordinates) {
                const cityId = city.searchKey || city.id || `${city.city}-${city.provinceState}-${city.country}`.toLowerCase();
                
                if (!seenIds.has(cityId)) {
                    seenIds.add(cityId);
                    uniqueCities.push({
                        id: cityId,
                        searchKey: cityId,
                        city: city.city,
                        provinceState: city.provinceState,
                        country: city.country,
                        countryName: city.countryName || (city.country === 'CA' ? 'Canada' : city.country === 'US' ? 'United States' : city.country),
                        postalZipCode: city.postalZipCode || city.postalCode || city.zipCode,
                        latitude: city.latitude,
                        longitude: city.longitude
                    });
                }
            }

            // Fetch coordinates for cities that don't have them
            const citiesWithCoords = await fetchCoordinatesForCities(uniqueCities, db, logger);

            logger.info('✅ Zone set expansion complete', {
                zoneSetId,
                totalCities: citiesWithCoords.length,
                citiesWithCoordinates: citiesWithCoords.filter(c => c.latitude && c.longitude).length
            });

            return {
                success: true,
                cities: citiesWithCoords,
                totalCount: citiesWithCoords.length,
                message: `Expanded ${citiesWithCoords.length} cities from zone set with coordinates`
            };

        } catch (error) {
            logger.error('❌ Error expanding zone set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to expand zone set',
                error.message
            );
        }
    });

/**
 * Create a custom carrier zone (individual zone)
 */
exports.createCarrierCustomZone = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { carrierId, carrierName, zoneCode, zoneName, description, cities } = data;

            if (!carrierId || !zoneCode || !zoneName) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, zone code, and zone name are required'
                );
            }

            logger.info('🔄 Creating custom carrier zone', {
                carrierId,
                zoneCode,
                zoneName,
                cityCount: cities?.length || 0
            });

            const db = admin.firestore();
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const currentTime = new Date();

            // Create zone object
            const newZone = {
                zoneId: zoneCode,
                zoneCode: zoneCode,
                zoneName: zoneName.trim(),
                description: description?.trim() || '',
                cities: cities || [],
                totalCities: cities?.length || 0,
                enabled: true,
                createdAt: currentTime,
                updatedAt: currentTime,
                createdBy: context.auth.uid
            };

            // Check if carrier custom zones document exists
            const carrierZonesQuery = await db.collection('carrierCustomZones')
                .where('carrierId', '==', carrierId)
                .limit(1)
                .get();

            if (!carrierZonesQuery.empty) {
                // Update existing document
                const docRef = carrierZonesQuery.docs[0].ref;
                const existingData = carrierZonesQuery.docs[0].data();
                
                const updatedZones = [...(existingData.zones || []), newZone];
                
                await docRef.update({
                    zones: updatedZones,
                    updatedAt: timestamp
                });
                
                logger.info('✅ Added zone to existing carrier zones', {
                    carrierId,
                    zoneId: newZone.zoneId
                });
            } else {
                // Create new document
                await db.collection('carrierCustomZones').add({
                    carrierId,
                    carrierName: carrierName || 'Unknown Carrier',
                    zones: [newZone],
                    zoneSets: [],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    createdBy: context.auth.uid
                });
                
                logger.info('✅ Created new carrier zones document with zone', {
                    carrierId,
                    zoneId: newZone.zoneId
                });
            }

            return {
                success: true,
                zoneId: newZone.zoneId,
                message: 'Custom zone created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating custom zone', {
                error: error.message,
                stack: error.stack
            });
            
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            
            throw new functions.https.HttpsError(
                'internal',
                'Failed to create custom zone'
            );
        }
    });

/**
 * Update a custom carrier zone (individual zone)
 * v2 onCall with explicit CORS to satisfy browser preflight
 */
exports.updateCarrierCustomZone = onCall(
    {
        region: 'us-central1',
        cors: true,
        timeoutSeconds: 60,
        memory: '256MiB'
    },
    async (request) => {
        try {
            const { auth, data } = request;

            if (!auth) {
                throw new HttpsError('unauthenticated', 'User must be authenticated');
            }

            const { carrierId, carrierName, zoneId, zoneCode, zoneName, description, cities } = data || {};

            if (!carrierId || !zoneId || !zoneCode || !zoneName) {
                throw new HttpsError('invalid-argument', 'Carrier ID, zone ID, zone code, and zone name are required');
            }

            const db = admin.firestore();
            const currentTime = new Date();

            // Find the carrier custom zones document
            const carrierZonesQuery = await db.collection('carrierCustomZones')
                .where('carrierId', '==', carrierId)
                .limit(1)
                .get();

            if (carrierZonesQuery.empty) {
                throw new HttpsError('not-found', 'Carrier custom zones document not found');
            }

            const docRef = carrierZonesQuery.docs[0].ref;
            const existingData = carrierZonesQuery.docs[0].data();

            // Update the specific zone in the zones array
            const updatedZones = (existingData.zones || []).map(zone => {
                if (zone.zoneId === zoneId) {
                    return {
                        ...zone,
                        zoneCode,
                        zoneName: String(zoneName).trim(),
                        description: (description ? String(description) : '').trim(),
                        cities: Array.isArray(cities) ? cities : [],
                        totalCities: Array.isArray(cities) ? cities.length : 0,
                        updatedAt: currentTime,
                        updatedBy: auth.uid
                    };
                }
                return zone;
            });

            // Check if zone was found and updated
            const zoneFound = updatedZones.some(zone => zone.zoneId === zoneId);
            if (!zoneFound) {
                throw new HttpsError('not-found', 'Zone not found in carrier custom zones');
            }

            await docRef.update({
                zones: updatedZones,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            v2Logger.info('✅ Custom zone updated', { carrierId, zoneId, zoneCode });

            return {
                success: true,
                zoneId,
                message: 'Custom zone updated successfully'
            };

        } catch (error) {
            const message = error && typeof error.message === 'string' ? error.message : String(error);
            v2Logger.error('❌ Failed to update custom zone', { error: message });
            if (error instanceof HttpsError) {
                throw error;
            }
            throw new HttpsError('internal', 'Failed to update custom zone: ' + message);
        }
    }
);

/**
 * Get carrier custom zone sets
 */
exports.getCarrierCustomZoneSets = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { carrierId } = data;

            if (!carrierId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID is required'
                );
            }

            logger.info('🔄 Loading carrier custom zone sets', { carrierId });

            const db = admin.firestore();

            // Get custom zone sets for this carrier
            const customZonesQuery = await db.collection('carrierCustomZones')
                .where('carrierId', '==', carrierId)
                .get();

            const zoneSets = [];
            
            customZonesQuery.forEach(doc => {
                const data = doc.data();
                if (data.zoneSets && Array.isArray(data.zoneSets)) {
                    zoneSets.push(...data.zoneSets.map(zoneSet => ({
                        ...zoneSet,
                        docId: doc.id,
                        type: 'custom'
                    })));
                }
            });

            logger.info('✅ Custom zone sets loaded', {
                carrierId,
                zoneSetCount: zoneSets.length
            });

            return {
                success: true,
                zoneSets,
                message: `Found ${zoneSets.length} custom zone sets`
            };

        } catch (error) {
            logger.error('❌ Error loading carrier custom zone sets', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to load custom zone sets',
                error.message
            );
        }
    });

/**
 * Get individual custom carrier zones (flat list)
 */
exports.getCarrierCustomZones = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        try {
            if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
            }

            const { carrierId } = data || {};
            if (!carrierId) {
                throw new functions.https.HttpsError('invalid-argument', 'Carrier ID is required');
            }

            logger.info('🔄 Loading individual custom zones for carrier', { carrierId });

            const db = admin.firestore();
            const snap = await db.collection('carrierCustomZones')
                .where('carrierId', '==', carrierId)
                .get();

            const zones = [];
            snap.forEach(doc => {
                const data = doc.data();
                const list = Array.isArray(data.zones) ? data.zones : [];
                list.forEach(z => zones.push({ ...z, docId: doc.id }));
            });

            logger.info('✅ Custom zones loaded', { carrierId, count: zones.length });

            return { success: true, zones };
        } catch (error) {
            logger.error('❌ Error loading custom zones', { error: error.message });
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError('internal', 'Failed to load custom zones', error.message);
        }
    });

/**
 * Create custom carrier zone set
 */
exports.createCarrierCustomZoneSet = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { carrierId, carrierName, zoneSetName, description, zones } = data;

            if (!carrierId || !zoneSetName || !zones) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, zone set name, and zones are required'
                );
            }

            logger.info('🔄 Creating custom carrier zone set', {
                carrierId,
                zoneSetName,
                zoneCount: zones.length
            });

            const db = admin.firestore();
            const timestamp = admin.firestore.FieldValue.serverTimestamp();

            // Create zone set object
            const currentTime = new Date();
            const newZoneSet = {
                id: `custom_${Date.now()}`,
                name: zoneSetName.trim(),
                description: description?.trim() || '',
                zones: zones.map(zone => ({
                    zoneId: zone.zoneId || `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: zone.name,
                    cities: zone.cities || [],
                    enabled: zone.enabled !== false,
                    metadata: zone.metadata || {},
                    createdAt: currentTime,
                    updatedAt: currentTime
                })),
                totalCities: zones.reduce((sum, zone) => sum + (zone.cities?.length || 0), 0),
                enabled: true,
                createdAt: currentTime,
                updatedAt: currentTime,
                createdBy: context.auth.uid
            };

            // Check if carrier custom zones document exists
            const carrierZonesQuery = await db.collection('carrierCustomZones')
                .where('carrierId', '==', carrierId)
                .limit(1)
                .get();

            if (!carrierZonesQuery.empty) {
                // Update existing document
                const docRef = carrierZonesQuery.docs[0].ref;
                const existingData = carrierZonesQuery.docs[0].data();
                
                const updatedZoneSets = [...(existingData.zoneSets || []), newZoneSet];
                
                await docRef.update({
                    zoneSets: updatedZoneSets,
                    updatedAt: timestamp
                });
                
                logger.info('✅ Added zone set to existing carrier zones', {
                    carrierId,
                    zoneSetId: newZoneSet.id
                });
            } else {
                // Create new document
                await db.collection('carrierCustomZones').add({
                    carrierId,
                    carrierName: carrierName || 'Unknown Carrier',
                    zoneSets: [newZoneSet],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    createdBy: context.auth.uid
                });
                
                logger.info('✅ Created new carrier zones document', {
                    carrierId,
                    zoneSetId: newZoneSet.id
                });
            }

            return {
                success: true,
                zoneSetId: newZoneSet.id,
                message: 'Custom zone set created successfully'
            };

        } catch (error) {
            logger.error('❌ Error creating custom zone set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to create custom zone set',
                error.message
            );
        }
    });

/**
 * Update custom carrier zone set
 */
exports.updateCarrierCustomZoneSet = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { carrierId, zoneSetId, updates } = data;

            if (!carrierId || !zoneSetId || !updates) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, zone set ID, and updates are required'
                );
            }

            logger.info('🔄 Updating custom carrier zone set', {
                carrierId,
                zoneSetId
            });

            const db = admin.firestore();
            const timestamp = admin.firestore.FieldValue.serverTimestamp();

            // Find and update the zone set
            const carrierZonesQuery = await db.collection('carrierCustomZones')
                .where('carrierId', '==', carrierId)
                .get();

            if (carrierZonesQuery.empty) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier custom zones not found'
                );
            }

            let updated = false;
            for (const doc of carrierZonesQuery.docs) {
                const data = doc.data();
                if (data.zoneSets && Array.isArray(data.zoneSets)) {
                    const zoneSetIndex = data.zoneSets.findIndex(zs => zs.id === zoneSetId);
                    if (zoneSetIndex !== -1) {
                        // Update the zone set
                        const updatedZoneSet = {
                            ...data.zoneSets[zoneSetIndex],
                            ...updates,
                            updatedAt: timestamp,
                            updatedBy: context.auth.uid
                        };

                        // Recalculate total cities if zones were updated
                        if (updates.zones) {
                            updatedZoneSet.totalCities = updates.zones.reduce(
                                (sum, zone) => sum + (zone.cities?.length || 0), 
                                0
                            );
                        }

                        data.zoneSets[zoneSetIndex] = updatedZoneSet;

                        await doc.ref.update({
                            zoneSets: data.zoneSets,
                            updatedAt: timestamp
                        });

                        updated = true;
                        break;
                    }
                }
            }

            if (!updated) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Zone set not found'
                );
            }

            logger.info('✅ Custom zone set updated', {
                carrierId,
                zoneSetId
            });

            return {
                success: true,
                message: 'Custom zone set updated successfully'
            };

        } catch (error) {
            logger.error('❌ Error updating custom zone set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to update custom zone set',
                error.message
            );
        }
    });

/**
 * Delete custom carrier zone set
 */
exports.deleteCarrierCustomZoneSet = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { carrierId, zoneSetId } = data;

            if (!carrierId || !zoneSetId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID and zone set ID are required'
                );
            }

            logger.info('🔄 Deleting custom carrier zone set', {
                carrierId,
                zoneSetId
            });

            const db = admin.firestore();

            // Find and delete the zone set
            const carrierZonesQuery = await db.collection('carrierCustomZones')
                .where('carrierId', '==', carrierId)
                .get();

            if (carrierZonesQuery.empty) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier custom zones not found'
                );
            }

            let deleted = false;
            for (const doc of carrierZonesQuery.docs) {
                const data = doc.data();
                if (data.zoneSets && Array.isArray(data.zoneSets)) {
                    const filteredZoneSets = data.zoneSets.filter(zs => zs.id !== zoneSetId);
                    
                    if (filteredZoneSets.length !== data.zoneSets.length) {
                        await doc.ref.update({
                            zoneSets: filteredZoneSets,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        deleted = true;
                        break;
                    }
                }
            }

            if (!deleted) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Zone set not found'
                );
            }

            logger.info('✅ Custom zone set deleted', {
                carrierId,
                zoneSetId
            });

            return {
                success: true,
                message: 'Custom zone set deleted successfully'
            };

        } catch (error) {
            logger.error('❌ Error deleting custom zone set', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to delete custom zone set',
                error.message
            );
        }
    });

/**
 * Expand carrier custom zones to cities
 */
exports.expandCarrierCustomZonesToCities = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { carrierId, zoneIds } = data;

            if (!carrierId || !zoneIds || !Array.isArray(zoneIds)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID and zone IDs array are required'
                );
            }

            logger.info('🔄 Expanding carrier custom zones to cities', { carrierId, zoneCount: zoneIds.length });

            const db = admin.firestore();
            const allCities = [];

            // Get carrier custom zones
            for (const zoneId of zoneIds) {
                try {
                    const zoneQuery = await db.collection('carrierCustomZones')
                        .where('carrierId', '==', carrierId)
                        .where('zones', 'array-contains', { id: zoneId })
                        .get();

                    if (!zoneQuery.empty) {
                        zoneQuery.forEach(doc => {
                            const data = doc.data();
                            if (data.zones && Array.isArray(data.zones)) {
                                const zone = data.zones.find(z => z.id === zoneId);
                                if (zone && zone.cities && Array.isArray(zone.cities)) {
                                    allCities.push(...zone.cities);
                                }
                            }
                        });
                    }
                } catch (error) {
                    logger.error(`❌ Error processing custom zone ${zoneId}:`, error.message);
                }
            }

            // Remove duplicates
            const cityMap = new Map();
            allCities.forEach(city => {
                const cityKey = `${city.city}-${city.provinceState}-${city.country}`;
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, city);
                }
            });

            const uniqueCities = Array.from(cityMap.values());

            // Fetch coordinates for cities that don't have them
            const citiesWithCoords = await fetchCoordinatesForCities(uniqueCities, db, logger);

            logger.info('✅ Carrier custom zones expansion complete', {
                carrierId,
                totalCities: citiesWithCoords.length,
                citiesWithCoordinates: citiesWithCoords.filter(c => c.latitude && c.longitude).length
            });

            return {
                success: true,
                cities: citiesWithCoords,
                totalCount: citiesWithCoords.length,
                message: `Expanded ${citiesWithCoords.length} cities from custom zones with coordinates`
            };

        } catch (error) {
            logger.error('❌ Error expanding carrier custom zones', {
                carrierId: data.carrierId,
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to expand carrier custom zones',
                error.message
            );
        }
    });

/**
 * Expand carrier custom zone sets to cities
 */
exports.expandCarrierCustomZoneSetsToCS = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Authentication check
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated'
                );
            }

            const { carrierId, zoneSetIds } = data;

            if (!carrierId || !zoneSetIds || !Array.isArray(zoneSetIds)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID and zone set IDs array are required'
                );
            }

            logger.info('🔄 Expanding carrier custom zone sets to cities', { carrierId, zoneSetCount: zoneSetIds.length });

            const db = admin.firestore();
            const allCities = [];

            // Get carrier custom zone sets
            for (const zoneSetId of zoneSetIds) {
                try {
                    const zoneSetQuery = await db.collection('carrierCustomZones')
                        .where('carrierId', '==', carrierId)
                        .where('zoneSets', 'array-contains', { id: zoneSetId })
                        .get();

                    if (!zoneSetQuery.empty) {
                        zoneSetQuery.forEach(doc => {
                            const data = doc.data();
                            if (data.zoneSets && Array.isArray(data.zoneSets)) {
                                const zoneSet = data.zoneSets.find(zs => zs.id === zoneSetId);
                                if (zoneSet && zoneSet.zones && Array.isArray(zoneSet.zones)) {
                                    // Expand each zone in the zone set
                                    zoneSet.zones.forEach(zone => {
                                        if (zone.cities && Array.isArray(zone.cities)) {
                                            allCities.push(...zone.cities);
                                        }
                                    });
                                }
                            }
                        });
                    }
                } catch (error) {
                    logger.error(`❌ Error processing custom zone set ${zoneSetId}:`, error.message);
                }
            }

            // Remove duplicates
            const cityMap = new Map();
            allCities.forEach(city => {
                const cityKey = `${city.city}-${city.provinceState}-${city.country}`;
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, city);
                }
            });

            const uniqueCities = Array.from(cityMap.values());

            // Fetch coordinates for cities that don't have them
            const citiesWithCoords = await fetchCoordinatesForCities(uniqueCities, db, logger);

            logger.info('✅ Carrier custom zone sets expansion complete', {
                carrierId,
                totalCities: citiesWithCoords.length,
                citiesWithCoordinates: citiesWithCoords.filter(c => c.latitude && c.longitude).length
            });

            return {
                success: true,
                cities: citiesWithCoords,
                totalCount: citiesWithCoords.length,
                message: `Expanded ${citiesWithCoords.length} cities from custom zone sets with coordinates`
            };

        } catch (error) {
            logger.error('❌ Error expanding carrier custom zone sets', {
                carrierId: data.carrierId,
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to expand carrier custom zone sets',
                error.message
            );
        }
    });

// Helper functions

/**
 * Expand geographic pattern to cities
 */
async function expandGeographicPattern(pattern, db) {
    const cities = [];
    
    try {
        if (pattern.type === 'province' || pattern.type === 'state') {
            // Query cities by province/state
            const citiesQuery = await db.collection('geoCities')
                .where('provinceState', '==', pattern.code)
                .get();
            
            citiesQuery.forEach(doc => {
                cities.push(doc.data());
            });
        } else if (pattern.type === 'country') {
            // Query cities by country
            const citiesQuery = await db.collection('geoCities')
                .where('country', '==', pattern.code)
                .limit(1000) // Limit to prevent huge results
                .get();
            
            citiesQuery.forEach(doc => {
                cities.push(doc.data());
            });
        } else if (pattern.type === 'postal_prefix') {
            // Query by postal code prefix
            const citiesQuery = await db.collection('geoLocations')
                .where('postalZipCode', '>=', pattern.prefix)
                .where('postalZipCode', '<', pattern.prefix + '\uf8ff')
                .limit(500)
                .get();
            
            citiesQuery.forEach(doc => {
                const data = doc.data();
                cities.push({
                    city: data.city,
                    provinceState: data.provinceState,
                    country: data.country,
                    countryName: data.countryName,
                    postalZipCode: data.postalZipCode,
                    latitude: data.latitude,
                    longitude: data.longitude
                });
            });
        }
    } catch (error) {
        functions.logger.warn(`Error expanding pattern ${pattern.type}:`, error.message);
    }
    
    return cities;
}

/**
 * Expand region to cities
 */
async function expandRegionToCities(regionId, db) {
    const cities = [];
    
    try {
        const regionDoc = await db.collection('regions').doc(regionId).get();
        if (regionDoc.exists) {
            const regionData = regionDoc.data();
            
            if (regionData.cities && Array.isArray(regionData.cities)) {
                cities.push(...regionData.cities);
            }
            
            // If region has patterns, expand them
            if (regionData.patterns && Array.isArray(regionData.patterns)) {
                for (const pattern of regionData.patterns) {
                    const expandedCities = await expandGeographicPattern(pattern, db);
                    cities.push(...expandedCities);
                }
            }
        }
    } catch (error) {
        functions.logger.warn(`Error expanding region ${regionId}:`, error.message);
    }
    
    return cities;
}

/**
 * Expand zone set by geography metadata
 */
async function expandZoneSetByGeography(zoneSetData, db) {
    const cities = [];
    
    try {
        const geography = zoneSetData.geography;
        const metadata = zoneSetData.metadata || {};
        
        if (geography === 'CA_FSA' || metadata.type === 'fsa_based') {
            // Canadian FSA-based zones
            const citiesQuery = await db.collection('geoCities')
                .where('country', '==', 'CA')
                .limit(1000)
                .get();
            
            citiesQuery.forEach(doc => {
                cities.push(doc.data());
            });
        } else if (geography === 'US_ZIP3' || metadata.type === 'zip3_based') {
            // US ZIP3-based zones
            const citiesQuery = await db.collection('geoCities')
                .where('country', '==', 'US')
                .limit(1000)
                .get();
            
            citiesQuery.forEach(doc => {
                cities.push(doc.data());
            });
        } else if (geography === 'NA_COURIER' || geography === 'NA_LTL') {
            // North American zones (CA + US)
            const caQuery = await db.collection('geoCities')
                .where('country', '==', 'CA')
                .limit(500)
                .get();
            
            const usQuery = await db.collection('geoCities')
                .where('country', '==', 'US')
                .limit(500)
                .get();
            
            caQuery.forEach(doc => cities.push(doc.data()));
            usQuery.forEach(doc => cities.push(doc.data()));
        }
        
        // Filter by regions if specified
        if (metadata.regions && Array.isArray(metadata.regions)) {
            const filteredCities = cities.filter(city => 
                metadata.regions.includes(city.country)
            );
            return filteredCities;
        }
    } catch (error) {
        functions.logger.warn(`Error expanding geography ${zoneSetData.geography}:`, error.message);
    }
    
    return cities;
}
