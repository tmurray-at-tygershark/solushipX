/**
 * Carrier Zone Management Service
 * Handles all zone and city management operations for carriers
 */

import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { functions, db } from '../firebase';

/**
 * Add cities to carrier pickup or delivery locations
 */
export const addCitiesToCarrier = async (carrierId, carrierName, cities, locationType) => {
    try {
        console.log(`🏙️ Adding ${cities.length} cities to ${carrierName} ${locationType} locations`);
        
        // Get current carrier configuration
        const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
        const carrierConfigDoc = await getDoc(carrierConfigRef);
        
        let currentConfig = {
            carrierId,
            carrierName,
            zoneConfig: {
                pickupZones: { selectedCities: [] },
                deliveryZones: { selectedCities: [] }
            }
        };

        if (carrierConfigDoc.exists()) {
            currentConfig = carrierConfigDoc.data();
        }

        // Ensure the zone config structure exists
        if (!currentConfig.zoneConfig) {
            currentConfig.zoneConfig = {
                pickupZones: { selectedCities: [] },
                deliveryZones: { selectedCities: [] }
            };
        }

        if (!currentConfig.zoneConfig[locationType]) {
            currentConfig.zoneConfig[locationType] = { selectedCities: [] };
        }

        if (!currentConfig.zoneConfig[locationType].selectedCities) {
            currentConfig.zoneConfig[locationType].selectedCities = [];
        }

        // Get existing cities to prevent duplicates
        const existingCities = currentConfig.zoneConfig[locationType].selectedCities || [];
        const existingCityIds = new Set(existingCities.map(city => city.searchKey || city.id));

        // Filter out duplicates
        const newCities = cities.filter(city => {
            const cityId = city.searchKey || city.id;
            return !existingCityIds.has(cityId);
        });

        // Add new cities
        const updatedCities = [...existingCities, ...newCities];

        // Update configuration
        const updatedConfig = {
            ...currentConfig,
            zoneConfig: {
                ...currentConfig.zoneConfig,
                [locationType]: {
                    ...currentConfig.zoneConfig[locationType],
                    selectedCities: updatedCities
                }
            },
            lastUpdated: new Date(),
            version: '2.0'
        };

        // Save to database
        await setDoc(carrierConfigRef, updatedConfig, { merge: true });

        console.log(`✅ Added ${newCities.length} new cities to ${carrierName} ${locationType}`);
        
        return {
            success: true,
            addedCities: newCities.length,
            totalCities: updatedCities.length,
            message: `Added ${newCities.length} cities to ${locationType} locations`
        };

    } catch (error) {
        console.error('Error adding cities to carrier:', error);
        throw error;
    }
};

/**
 * Add system zones to carrier configuration
 */
export const addSystemZonesToCarrier = async (carrierId, carrierName, zones, locationType) => {
    try {
        console.log(`🗺️ Adding ${zones.length} system zones to ${carrierName} ${locationType}`);
        
        // Expand zones to cities
        const allCities = [];
        for (const zone of zones) {
            if (zone.cities && Array.isArray(zone.cities)) {
                allCities.push(...zone.cities);
            }
        }

        // Add cities to carrier
        const cityResult = await addCitiesToCarrier(carrierId, carrierName, allCities, locationType);

        // Save zone references
        await saveZoneReferences(carrierId, carrierName, zones, locationType, 'system_zones');

        return {
            success: true,
            addedZones: zones.length,
            addedCities: cityResult.addedCities,
            totalCities: cityResult.totalCities,
            message: `Added ${zones.length} system zones with ${cityResult.addedCities} new cities`
        };

    } catch (error) {
        console.error('Error adding system zones to carrier:', error);
        throw error;
    }
};

/**
 * Add system zone sets to carrier configuration
 */
export const addSystemZoneSetsToCarrier = async (carrierId, carrierName, zoneSets, locationType) => {
    try {
        console.log(`📦 Adding ${zoneSets.length} system zone sets to ${carrierName} ${locationType}`);
        
        // Expand zone sets to cities using cloud function
        const allCities = [];
        for (const zoneSet of zoneSets) {
            try {
                const expandZoneSet = httpsCallable(functions, 'expandZoneSetToCities');
                const result = await expandZoneSet({ zoneSetId: zoneSet.id });
                
                if (result.data.success) {
                    allCities.push(...result.data.cities);
                }
            } catch (error) {
                console.error(`Error expanding zone set ${zoneSet.name}:`, error);
            }
        }

        // Add cities to carrier
        const cityResult = await addCitiesToCarrier(carrierId, carrierName, allCities, locationType);

        // Save zone set references
        await saveZoneReferences(carrierId, carrierName, zoneSets, locationType, 'system_zone_sets');

        return {
            success: true,
            addedZoneSets: zoneSets.length,
            addedCities: cityResult.addedCities,
            totalCities: cityResult.totalCities,
            message: `Added ${zoneSets.length} system zone sets with ${cityResult.addedCities} new cities`
        };

    } catch (error) {
        console.error('Error adding system zone sets to carrier:', error);
        throw error;
    }
};

/**
 * Add custom carrier zones to configuration
 */
export const addCustomZonesToCarrier = async (carrierId, carrierName, zones, locationType) => {
    try {
        console.log(`🎯 Adding ${zones.length} custom zones to ${carrierName} ${locationType}`);
        
        // Expand zones to cities using cloud function for coordinate fetching
        const allCities = [];
        const zoneIds = zones.map(z => z.id);
        
        if (zoneIds.length > 0) {
            try {
                const expandCustomZones = httpsCallable(functions, 'expandCarrierCustomZonesToCities');
                const result = await expandCustomZones({ carrierId, zoneIds });
                
                if (result.data.success) {
                    allCities.push(...result.data.cities);
                }
            } catch (error) {
                console.error('Error expanding custom zones:', error);
                // Fallback to local expansion
                for (const zone of zones) {
                    if (zone.cities && Array.isArray(zone.cities)) {
                        allCities.push(...zone.cities);
                    }
                }
            }
        }

        // Add cities to carrier
        const cityResult = await addCitiesToCarrier(carrierId, carrierName, allCities, locationType);

        // Save zone references
        await saveZoneReferences(carrierId, carrierName, zones, locationType, 'custom_zones');

        return {
            success: true,
            addedZones: zones.length,
            addedCities: cityResult.addedCities,
            totalCities: cityResult.totalCities,
            message: `Added ${zones.length} custom zones with ${cityResult.addedCities} new cities`
        };

    } catch (error) {
        console.error('Error adding custom zones to carrier:', error);
        throw error;
    }
};

/**
 * Add custom carrier zone sets to configuration
 */
export const addCustomZoneSetsToCarrier = async (carrierId, carrierName, zoneSets, locationType) => {
    try {
        console.log(`📋 Adding ${zoneSets.length} custom zone sets to ${carrierName} ${locationType}`);
        
        // Expand zone sets to cities using cloud function for coordinate fetching
        const allCities = [];
        const zoneSetIds = zoneSets.map(zs => zs.id);
        
        if (zoneSetIds.length > 0) {
            try {
                const expandCustomZoneSets = httpsCallable(functions, 'expandCarrierCustomZoneSetsToCS');
                const result = await expandCustomZoneSets({ carrierId, zoneSetIds });
                
                if (result.data.success) {
                    allCities.push(...result.data.cities);
                }
            } catch (error) {
                console.error('Error expanding custom zone sets:', error);
                // Fallback to local expansion
                for (const zoneSet of zoneSets) {
                    if (zoneSet.zones && Array.isArray(zoneSet.zones)) {
                        zoneSet.zones.forEach(zone => {
                            if (zone.cities && Array.isArray(zone.cities)) {
                                allCities.push(...zone.cities);
                            }
                        });
                    }
                }
            }
        }

        // Add cities to carrier
        const cityResult = await addCitiesToCarrier(carrierId, carrierName, allCities, locationType);

        // Save zone set references
        await saveZoneReferences(carrierId, carrierName, zoneSets, locationType, 'custom_zone_sets');

        return {
            success: true,
            addedZoneSets: zoneSets.length,
            addedCities: cityResult.addedCities,
            totalCities: cityResult.totalCities,
            message: `Added ${zoneSets.length} custom zone sets with ${cityResult.addedCities} new cities`
        };

    } catch (error) {
        console.error('Error adding custom zone sets to carrier:', error);
        throw error;
    }
};

/**
 * Save zone references to carrier configuration
 */
const saveZoneReferences = async (carrierId, carrierName, items, locationType, referenceType) => {
    try {
        const carrierZoneRefsRef = doc(db, 'carrierZoneReferences', carrierId);
        const carrierZoneRefsDoc = await getDoc(carrierZoneRefsRef);
        
        let currentRefs = {
            carrierId,
            carrierName,
            pickupZones: {
                system_zones: [],
                system_zone_sets: [],
                custom_zones: [],
                custom_zone_sets: []
            },
            deliveryZones: {
                system_zones: [],
                system_zone_sets: [],
                custom_zones: [],
                custom_zone_sets: []
            }
        };

        if (carrierZoneRefsDoc.exists()) {
            currentRefs = carrierZoneRefsDoc.data();
        }

        // Ensure structure exists
        if (!currentRefs[locationType]) {
            currentRefs[locationType] = {
                system_zones: [],
                system_zone_sets: [],
                custom_zones: [],
                custom_zone_sets: []
            };
        }

        if (!currentRefs[locationType][referenceType]) {
            currentRefs[locationType][referenceType] = [];
        }

        // Get existing references to prevent duplicates
        const existingRefs = currentRefs[locationType][referenceType] || [];
        const existingIds = new Set(existingRefs.map(ref => ref.id).filter(Boolean));

        // Normalize and add new references (avoid undefined fields)
        const newRefs = items
            .map(item => ({
                id: item?.id || item?.zoneId || item?.zoneCode || null,
                name: item?.name || item?.zoneName || item?.zoneCode || 'Unnamed Zone',
                type: referenceType,
                addedAt: new Date()
            }))
            .filter(ref => ref.id && !existingIds.has(ref.id));

        currentRefs[locationType][referenceType] = [...existingRefs, ...newRefs];
        currentRefs.lastUpdated = new Date();

        // Save to database
        await setDoc(carrierZoneRefsRef, currentRefs, { merge: true });

        console.log(`✅ Saved ${newRefs.length} ${referenceType} references for ${carrierName}`);

    } catch (error) {
        console.error('Error saving zone references:', error);
        throw error;
    }
};

/**
 * Remove zones or zone sets from carrier configuration
 */
export const removeZonesFromCarrier = async (carrierId, carrierName, itemIds, locationType, referenceType) => {
    try {
        console.log(`🗑️ Removing ${itemIds.length} ${referenceType} from ${carrierName} ${locationType}`);
        
        // Remove zone references
        const carrierZoneRefsRef = doc(db, 'carrierZoneReferences', carrierId);
        const carrierZoneRefsDoc = await getDoc(carrierZoneRefsRef);
        
        if (carrierZoneRefsDoc.exists()) {
            const currentRefs = carrierZoneRefsDoc.data();
            
            if (currentRefs[locationType] && currentRefs[locationType][referenceType]) {
                currentRefs[locationType][referenceType] = currentRefs[locationType][referenceType]
                    .filter(ref => !itemIds.includes(ref.id));
                
                currentRefs.lastUpdated = new Date();
                await setDoc(carrierZoneRefsRef, currentRefs, { merge: true });
            }
        }

        // TODO: Also remove cities that are no longer covered by any zones
        // This requires checking all remaining zones to see which cities are still needed

        return {
            success: true,
            message: `Removed ${itemIds.length} ${referenceType} from ${locationType} locations`
        };

    } catch (error) {
        console.error('Error removing zones from carrier:', error);
        throw error;
    }
};

/**
 * Get carrier zone configuration
 */
export const getCarrierZoneConfiguration = async (carrierId) => {
    try {
        const [configDoc, refsDoc] = await Promise.all([
            getDoc(doc(db, 'carrierZoneConfigs', carrierId)),
            getDoc(doc(db, 'carrierZoneReferences', carrierId))
        ]);

        const config = configDoc.exists() ? configDoc.data() : null;
        const refs = refsDoc.exists() ? refsDoc.data() : null;

        return {
            config,
            references: refs,
            success: true
        };

    } catch (error) {
        console.error('Error getting carrier zone configuration:', error);
        throw error;
    }
};

/**
 * Update zone or zone set
 */
export const updateZoneOrZoneSet = async (itemId, updates, itemType) => {
    try {
        console.log(`📝 Updating ${itemType}:`, itemId);
        
        if (itemType === 'system_zone') {
            const updateZone = httpsCallable(functions, 'updateZone');
            return await updateZone({ zoneId: itemId, ...updates });
        } else if (itemType === 'system_zone_set') {
            // TODO: Implement system zone set update
            throw new Error('System zone set updates not yet implemented');
        } else if (itemType === 'custom_zone') {
            const updateCustomZone = httpsCallable(functions, 'updateCarrierCustomZoneSet');
            return await updateCustomZone({ zoneId: itemId, updates });
        } else if (itemType === 'custom_zone_set') {
            const updateCustomZoneSet = httpsCallable(functions, 'updateCarrierCustomZoneSet');
            return await updateCustomZoneSet({ zoneSetId: itemId, updates });
        }

        throw new Error(`Unknown item type: ${itemType}`);

    } catch (error) {
        console.error('Error updating zone/zone set:', error);
        throw error;
    }
};

/**
 * Delete zone or zone set
 */
export const deleteZoneOrZoneSet = async (itemId, itemType) => {
    try {
        console.log(`🗑️ Deleting ${itemType}:`, itemId);
        
        if (itemType === 'system_zone') {
            const deleteZone = httpsCallable(functions, 'deleteZone');
            return await deleteZone({ zoneId: itemId });
        } else if (itemType === 'system_zone_set') {
            const deleteZoneSet = httpsCallable(functions, 'deleteZoneSet');
            return await deleteZoneSet({ zoneSetId: itemId });
        } else if (itemType === 'custom_zone') {
            // TODO: Implement custom zone deletion
            throw new Error('Custom zone deletion not yet implemented');
        } else if (itemType === 'custom_zone_set') {
            const deleteCustomZoneSet = httpsCallable(functions, 'deleteCarrierCustomZoneSet');
            return await deleteCustomZoneSet({ zoneSetId: itemId });
        }

        throw new Error(`Unknown item type: ${itemType}`);

    } catch (error) {
        console.error('Error deleting zone/zone set:', error);
        throw error;
    }
};

/**
 * Expand zones to cities
 */
export const expandZonesToCities = async (zones) => {
    const cities = [];
    
    for (const zone of zones) {
        if (zone.cities && Array.isArray(zone.cities)) {
            cities.push(...zone.cities);
        }
    }
    
    return cities;
};

/**
 * Expand zone sets to cities
 */
export const expandZoneSetsToCity = async (zoneSets) => {
    const allCities = [];
    
    for (const zoneSet of zoneSets) {
        try {
            const expandZoneSet = httpsCallable(functions, 'expandZoneSetToCities');
            const result = await expandZoneSet({ zoneSetId: zoneSet.id });
            
            if (result.data.success) {
                allCities.push(...result.data.cities);
            }
        } catch (error) {
            console.error(`Error expanding zone set ${zoneSet.name}:`, error);
        }
    }
    
    return allCities;
};
