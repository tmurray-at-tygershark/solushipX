const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * DIM Factor Management System for SolushipX
 * Handles dimensional weight calculations for accurate carrier rating
 */

// Create or update DIM factor
exports.createDimFactor = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }

        const {
            carrierId,
            carrierName,
            serviceType,
            zone,
            dimFactor,
            unit,
            effectiveDate,
            expiryDate,
            isActive = true,
            notes
        } = data;

        // Validate required fields
        if (!carrierId || !dimFactor || !unit) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Carrier ID, DIM factor, and unit are required'
            );
        }

        // Validate DIM factor value
        if (dimFactor <= 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'DIM factor must be greater than 0'
            );
        }

        // Validate unit
        const validUnits = ['in³/lb', 'cm³/kg', 'in³/kg', 'cm³/lb'];
        if (!validUnits.includes(unit)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `Unit must be one of: ${validUnits.join(', ')}`
            );
        }

        const dimFactorData = {
            carrierId,
            carrierName: carrierName || null,
            serviceType: serviceType || 'all', // Default to 'all' services
            zone: zone || 'all', // Default to 'all' zones
            dimFactor: parseFloat(dimFactor),
            unit,
            effectiveDate: effectiveDate || new Date().toISOString(),
            expiryDate: expiryDate || null,
            isActive,
            notes: notes || '',
            createdAt: new Date().toISOString(),
            createdBy: context.auth.uid,
            updatedAt: new Date().toISOString()
        };

        // Create document with auto-generated ID
        const docRef = await db.collection('dimFactors').add(dimFactorData);

        return {
            success: true,
            dimFactorId: docRef.id,
            message: 'DIM factor created successfully'
        };

    } catch (error) {
        console.error('Error creating DIM factor:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create DIM factor');
    }
});

// Get DIM factors for a carrier
exports.getDimFactors = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication - temporarily relaxed for testing
        if (!context.auth || !context.auth.uid) {
            console.log('Authentication context:', JSON.stringify(context.auth, null, 2));
            // Temporarily allow unauthenticated access for testing
            console.log('Warning: Allowing unauthenticated access for testing');
        }

        const { carrierId, serviceType, zone, activeOnly = true } = data;

        // Temporarily use simple query until index builds
        let query = db.collection('dimFactors');

        // Filter by carrier if provided
        if (carrierId) {
            query = query.where('carrierId', '==', carrierId);
        }

        // Temporarily remove ordering until index builds
        const snapshot = await query.get();
        const dimFactors = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Client-side filtering until index builds
            // Filter by active status
            if (activeOnly && !data.isActive) {
                return;
            }
            
            // Filter by service type
            if (serviceType && data.serviceType !== serviceType && data.serviceType !== 'all') {
                return;
            }
            
            // Filter by zone
            if (zone && data.zone !== zone && data.zone !== 'all') {
                return;
            }
            
            // Check if factor is currently effective
            const now = new Date();
            const effectiveDate = new Date(data.effectiveDate);
            const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
            
            const isCurrentlyEffective = effectiveDate <= now && (!expiryDate || expiryDate > now);

            dimFactors.push({
                id: doc.id,
                ...data,
                isCurrentlyEffective
            });
        });

        // Client-side sorting by effective date (newest first)
        dimFactors.sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));

        return {
            success: true,
            dimFactors,
            count: dimFactors.length
        };

    } catch (error) {
        console.error('Error getting DIM factors:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get DIM factors');
    }
});

// Update DIM factor
exports.updateDimFactor = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }

        const { dimFactorId, updates } = data;

        if (!dimFactorId) {
            throw new functions.https.HttpsError('invalid-argument', 'DIM factor ID is required');
        }

        // Validate DIM factor if being updated
        if (updates.dimFactor !== undefined && updates.dimFactor <= 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'DIM factor must be greater than 0'
            );
        }

        // Validate unit if being updated
        if (updates.unit) {
            const validUnits = ['in³/lb', 'cm³/kg', 'in³/kg', 'cm³/lb'];
            if (!validUnits.includes(updates.unit)) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    `Unit must be one of: ${validUnits.join(', ')}`
                );
            }
        }

        const updateData = {
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: context.auth.uid
        };

        // Parse dimFactor to float if provided
        if (updateData.dimFactor !== undefined) {
            updateData.dimFactor = parseFloat(updateData.dimFactor);
        }

        await db.collection('dimFactors').doc(dimFactorId).update(updateData);

        return {
            success: true,
            message: 'DIM factor updated successfully'
        };

    } catch (error) {
        console.error('Error updating DIM factor:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to update DIM factor');
    }
});

// Delete DIM factor
exports.deleteDimFactor = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }

        const { dimFactorId } = data;

        if (!dimFactorId) {
            throw new functions.https.HttpsError('invalid-argument', 'DIM factor ID is required');
        }

        await db.collection('dimFactors').doc(dimFactorId).delete();

        return {
            success: true,
            message: 'DIM factor deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting DIM factor:', error);
        throw new functions.https.HttpsError('internal', 'Failed to delete DIM factor');
    }
});

// Calculate volumetric weight using DIM factors
exports.calculateVolumetricWeight = functions.https.onCall(async (data, context) => {
    try {
        const {
            carrierId,
            serviceType,
            zone,
            length,
            width,
            height,
            actualWeight,
            dimensionUnit = 'in', // 'in' or 'cm'
            weightUnit = 'lbs', // 'lbs' or 'kg'
            customerId = null // For customer-specific overrides
        } = data;

        // Validate required fields
        if (!carrierId || !length || !width || !height || !actualWeight) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Carrier ID, dimensions, and actual weight are required'
            );
        }

        // Get applicable DIM factor
        const dimFactor = await getApplicableDimFactor({
            carrierId,
            serviceType,
            zone,
            customerId
        });

        if (!dimFactor) {
            // No DIM factor found, return actual weight as chargeable weight
            return {
                success: true,
                volumetricWeight: 0,
                chargeableWeight: parseFloat(actualWeight),
                actualWeight: parseFloat(actualWeight),
                dimFactorUsed: null,
                calculation: 'No DIM factor found - using actual weight'
            };
        }

        // Convert dimensions to match DIM factor unit system
        const { convertedLength, convertedWidth, convertedHeight, convertedUnit } = 
            convertDimensions(length, width, height, dimensionUnit, dimFactor.unit);

        // Calculate volume
        const volume = convertedLength * convertedWidth * convertedHeight;

        // Calculate volumetric weight
        const volumetricWeight = volume / dimFactor.dimFactor;

        // Convert actual weight to match DIM factor weight unit
        const convertedActualWeight = convertWeight(actualWeight, weightUnit, dimFactor.unit);

        // Calculate chargeable weight (higher of actual or volumetric)
        const chargeableWeight = Math.max(convertedActualWeight, volumetricWeight);

        // Round up to nearest billing unit (0.1 for precision)
        const roundedChargeableWeight = Math.ceil(chargeableWeight * 10) / 10;

        const calculation = `Volume: ${convertedLength}"×${convertedWidth}"×${convertedHeight}" = ${volume.toFixed(2)}${convertedUnit} ÷ ${dimFactor.dimFactor} = ${volumetricWeight.toFixed(2)} ${getWeightUnitFromDimUnit(dimFactor.unit)}. Chargeable: max(${convertedActualWeight.toFixed(2)}, ${volumetricWeight.toFixed(2)}) = ${roundedChargeableWeight}`;

        return {
            success: true,
            volumetricWeight: parseFloat(volumetricWeight.toFixed(2)),
            chargeableWeight: roundedChargeableWeight,
            actualWeight: parseFloat(actualWeight),
            dimFactorUsed: {
                id: dimFactor.id,
                factor: dimFactor.dimFactor,
                unit: dimFactor.unit,
                serviceType: dimFactor.serviceType,
                zone: dimFactor.zone
            },
            calculation
        };

    } catch (error) {
        console.error('Error calculating volumetric weight:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to calculate volumetric weight');
    }
});

// Helper function to get applicable DIM factor
async function getApplicableDimFactor({ carrierId, serviceType, zone, customerId }) {
    try {
        // First check for customer-specific overrides
        if (customerId) {
            const customerOverride = await getCustomerDimFactorOverride(customerId, carrierId, serviceType, zone);
            if (customerOverride) {
                return customerOverride;
            }
        }

        // Get carrier DIM factors with priority:
        // 1. Specific service + specific zone
        // 2. Specific service + all zones
        // 3. All services + specific zone  
        // 4. All services + all zones

        const queries = [
            { serviceType: serviceType || 'all', zone: zone || 'all' },
            { serviceType: serviceType || 'all', zone: 'all' },
            { serviceType: 'all', zone: zone || 'all' },
            { serviceType: 'all', zone: 'all' }
        ];

        const now = new Date().toISOString();

        for (const queryParams of queries) {
            const snapshot = await db.collection('dimFactors')
                .where('carrierId', '==', carrierId)
                .where('serviceType', '==', queryParams.serviceType)
                .where('zone', '==', queryParams.zone)
                .where('isActive', '==', true)
                .where('effectiveDate', '<=', now)
                .orderBy('effectiveDate', 'desc')
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                
                // Check if not expired
                if (!data.expiryDate || new Date(data.expiryDate) > new Date()) {
                    return {
                        id: doc.id,
                        ...data
                    };
                }
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting applicable DIM factor:', error);
        return null;
    }
}

// Helper function to get customer DIM factor override
async function getCustomerDimFactorOverride(customerId, carrierId, serviceType, zone) {
    try {
        const snapshot = await db.collection('customerDimFactorOverrides')
            .where('customerId', '==', customerId)
            .where('carrierId', '==', carrierId)
            .where('isActive', '==', true)
            .orderBy('effectiveDate', 'desc')
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            
            // Check if matches service and zone (or is applicable to all)
            const serviceMatches = !data.serviceType || data.serviceType === 'all' || data.serviceType === serviceType;
            const zoneMatches = !data.zone || data.zone === 'all' || data.zone === zone;
            
            if (serviceMatches && zoneMatches) {
                // Check if not expired
                if (!data.expiryDate || new Date(data.expiryDate) > new Date()) {
                    return {
                        id: doc.id,
                        ...data,
                        isCustomerOverride: true
                    };
                }
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting customer DIM factor override:', error);
        return null;
    }
}

// Helper function to convert dimensions
function convertDimensions(length, width, height, fromUnit, dimFactorUnit) {
    const targetDimensionUnit = getDimensionUnitFromDimUnit(dimFactorUnit);
    
    if (fromUnit === targetDimensionUnit) {
        return {
            convertedLength: parseFloat(length),
            convertedWidth: parseFloat(width),
            convertedHeight: parseFloat(height),
            convertedUnit: targetDimensionUnit
        };
    }

    let conversionFactor;
    if (fromUnit === 'in' && targetDimensionUnit === 'cm') {
        conversionFactor = 2.54;
    } else if (fromUnit === 'cm' && targetDimensionUnit === 'in') {
        conversionFactor = 0.393701;
    } else {
        throw new Error(`Unsupported dimension conversion: ${fromUnit} to ${targetDimensionUnit}`);
    }

    return {
        convertedLength: parseFloat(length) * conversionFactor,
        convertedWidth: parseFloat(width) * conversionFactor,
        convertedHeight: parseFloat(height) * conversionFactor,
        convertedUnit: targetDimensionUnit
    };
}

// Helper function to convert weight
function convertWeight(weight, fromUnit, dimFactorUnit) {
    const targetWeightUnit = getWeightUnitFromDimUnit(dimFactorUnit);
    
    if ((fromUnit === 'lbs' && targetWeightUnit === 'lb') || 
        (fromUnit === 'kg' && targetWeightUnit === 'kg')) {
        return parseFloat(weight);
    }

    if (fromUnit === 'lbs' && targetWeightUnit === 'kg') {
        return parseFloat(weight) * 0.453592;
    } else if (fromUnit === 'kg' && targetWeightUnit === 'lb') {
        return parseFloat(weight) * 2.20462;
    }

    throw new Error(`Unsupported weight conversion: ${fromUnit} to ${targetWeightUnit}`);
}

// Helper function to extract dimension unit from DIM factor unit
function getDimensionUnitFromDimUnit(dimUnit) {
    if (dimUnit.includes('in³')) return 'in';
    if (dimUnit.includes('cm³')) return 'cm';
    throw new Error(`Unknown dimension unit in: ${dimUnit}`);
}

// Helper function to extract weight unit from DIM factor unit
function getWeightUnitFromDimUnit(dimUnit) {
    if (dimUnit.includes('/lb')) return 'lb';
    if (dimUnit.includes('/kg')) return 'kg';
    throw new Error(`Unknown weight unit in: ${dimUnit}`);
}

// Create customer DIM factor override
exports.createCustomerDimFactorOverride = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }

        const {
            customerId,
            carrierId,
            serviceType,
            zone,
            dimFactor,
            unit,
            effectiveDate,
            expiryDate,
            isActive = true,
            notes,
            reason
        } = data;

        // Validate required fields
        if (!customerId || !carrierId || !dimFactor || !unit) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Customer ID, Carrier ID, DIM factor, and unit are required'
            );
        }

        const overrideData = {
            customerId,
            carrierId,
            serviceType: serviceType || 'all',
            zone: zone || 'all',
            dimFactor: parseFloat(dimFactor),
            unit,
            effectiveDate: effectiveDate || new Date().toISOString(),
            expiryDate: expiryDate || null,
            isActive,
            notes: notes || '',
            reason: reason || '',
            createdAt: new Date().toISOString(),
            createdBy: context.auth.uid,
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection('customerDimFactorOverrides').add(overrideData);

        return {
            success: true,
            overrideId: docRef.id,
            message: 'Customer DIM factor override created successfully'
        };

    } catch (error) {
        console.error('Error creating customer DIM factor override:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create customer DIM factor override');
    }
});
