const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { getFunctions } = require('firebase-admin/functions');

// Get Firestore instance
const db = admin.firestore();

/**
 * Universal rate fetching function that calls all available carriers
 * Called by the AI agent to get rates from multiple carriers
 */
exports.getRatesUniversal = onCall(async (request) => {
    try {
        const { companyId, originAddress, destinationAddress, packages, shipmentInfo } = request.data;

        // Validate required parameters
        if (!companyId) {
            throw new HttpsError('invalid-argument', 'companyId is required');
        }
        if (!originAddress) {
            throw new HttpsError('invalid-argument', 'originAddress is required');
        }
        if (!destinationAddress) {
            throw new HttpsError('invalid-argument', 'destinationAddress is required');
        }
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
            throw new HttpsError('invalid-argument', 'packages array is required and must not be empty');
        }

        logger.info(`Getting universal rates for company ${companyId}`);

        // Get company data to ensure we have the correct companyId format
        const companyRef = db.collection('companies').doc(companyId);
        const companySnap = await companyRef.get();
        if (!companySnap.exists()) {
            throw new HttpsError('not-found', 'Company not found');
        }

        const companyData = companySnap.data();
        // Check for actual company ID - note that the field is "companyID" (capital ID) in the data
        const actualCompanyId = companyData.companyID || companyData.companyId || companyData.customerId || companyData.id || companyId;

        // Get enabled carriers for this company
        const enabledCarriers = await getEnabledCarriers(actualCompanyId);
        
        if (enabledCarriers.length === 0) {
            throw new HttpsError('failed-precondition', 'No carriers are enabled for this company. Please configure carriers first.');
        }

        logger.info(`Found ${enabledCarriers.length} enabled carriers:`, enabledCarriers.map(c => c.carrierID));

        // Prepare standardized rate request data
        const standardizedRequest = standardizeRateRequest({
            companyId: actualCompanyId,
            originAddress,
            destinationAddress,
            packages,
            shipmentInfo: shipmentInfo || {}
        });

        // Fetch rates from all enabled carriers in parallel
        const ratePromises = enabledCarriers.map(carrier => 
            fetchCarrierRates(carrier, standardizedRequest)
        );

        const rateResults = await Promise.allSettled(ratePromises);

        // Process results
        const allRates = [];
        const errors = [];

        rateResults.forEach((result, index) => {
            const carrier = enabledCarriers[index];
            
            if (result.status === 'fulfilled' && result.value.success) {
                const carrierRates = result.value.data.availableRates || [];
                // Add source carrier information to each rate
                const enhancedRates = carrierRates.map(rate => ({
                    ...rate,
                    sourceCarrierSystem: carrier.carrierID,
                    sourceCarrier: {
                        system: carrier.carrierID,
                        name: carrier.name,
                        key: carrier.carrierKey || carrier.carrierID
                    }
                }));
                allRates.push(...enhancedRates);
                logger.info(`${carrier.carrierID}: ${carrierRates.length} rates fetched`);
            } else {
                const error = result.status === 'rejected' ? result.reason : result.value.error;
                errors.push({
                    carrier: carrier.carrierID,
                    error: error.message || error
                });
                logger.warn(`${carrier.carrierID}: Failed to fetch rates -`, error);
            }
        });

        // Sort rates by total cost
        allRates.sort((a, b) => {
            const priceA = a.pricing?.total || a.totalCharges || a.total || 0;
            const priceB = b.pricing?.total || b.totalCharges || b.total || 0;
            return priceA - priceB;
        });

        logger.info(`Universal rates: ${allRates.length} total rates from ${enabledCarriers.length} carriers`);

        return {
            success: true,
            data: {
                availableRates: allRates,
                carrierResults: {
                    successful: enabledCarriers.length - errors.length,
                    failed: errors.length,
                    errors: errors
                },
                requestInfo: {
                    companyId: actualCompanyId,
                    carriersQueried: enabledCarriers.map(c => c.carrierID),
                    timestamp: new Date().toISOString()
                }
            }
        };

    } catch (error) {
        logger.error('Error in getRatesUniversal:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to fetch universal rates: ${error.message}`);
    }
});

/**
 * Get enabled carriers for a company
 */
async function getEnabledCarriers(companyId) {
    try {
        // Get carriers that are enabled for this company
        const carriersQuery = db.collection('carriers')
            .where('enabled', '==', true)
            .where('companyId', '==', companyId);

        const carriersSnapshot = await carriersQuery.get();
        
        if (carriersSnapshot.empty) {
            // Try global carriers if no company-specific carriers found
            const globalCarriersQuery = db.collection('carriers')
                .where('enabled', '==', true);
            
            const globalSnapshot = await globalCarriersQuery.get();
            return globalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        return carriersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (error) {
        logger.error('Error getting enabled carriers:', error);
        return [];
    }
}

/**
 * Standardize rate request data for all carriers
 */
function standardizeRateRequest({ companyId, originAddress, destinationAddress, packages, shipmentInfo }) {
    // Helper function to standardize address format
    const standardizeAddress = (address) => ({
        company: address.company || address.companyName || '',
        street: address.street || address.address1 || address.street1 || '',
        street2: address.street2 || address.address2 || '',
        city: address.city || '',
        state: address.state || address.stateProv || address.stateProvince || '',
        postalCode: address.postalCode || address.zipPostal || address.zip || '',
        country: address.country || address.countryCode || 'US',
        contactName: address.contactName || address.name || '',
        contactPhone: address.contactPhone || address.phone || '',
        contactEmail: address.contactEmail || address.email || '',
        specialInstructions: address.specialInstructions || ''
    });

    // Standardize packages
    const standardizedPackages = packages.map(pkg => ({
        description: pkg.description || 'Package',
        weight: parseFloat(pkg.weight) || 1,
        length: parseFloat(pkg.length) || 12,
        width: parseFloat(pkg.width) || 12,
        height: parseFloat(pkg.height) || 12,
        quantity: parseInt(pkg.quantity) || 1,
        freightClass: pkg.freightClass || '50',
        value: parseFloat(pkg.value) || 0,
        stackable: pkg.stackable || false
    }));

    return {
        companyId,
        fromAddress: standardizeAddress(originAddress),
        toAddress: standardizeAddress(destinationAddress),
        items: standardizedPackages,
        packages: standardizedPackages, // Some carriers expect 'packages'
        shipmentDate: shipmentInfo.shipmentDate || new Date().toISOString(),
        bookingReferenceNumber: shipmentInfo.bookingRef || 'AI-' + Date.now(),
        bookingReferenceNumberType: 'Shipment',
        shipmentBillType: 'DefaultLogisticsPlus',
        pickupWindow: {
            earliest: shipmentInfo.earliestPickup || '09:00',
            latest: shipmentInfo.latestPickup || '17:00'
        },
        deliveryWindow: {
            earliest: shipmentInfo.earliestDelivery || '09:00',
            latest: shipmentInfo.latestDelivery || '17:00'
        },
        hazardousGoods: shipmentInfo.hazardousGoods || false,
        signatureRequired: shipmentInfo.signatureRequired || false,
        adultSignatureRequired: shipmentInfo.adultSignatureRequired || false
    };
}

/**
 * Fetch rates from a specific carrier
 */
async function fetchCarrierRates(carrier, requestData) {
    try {
        const carrierID = carrier.carrierID.toUpperCase();
        
        logger.info(`Fetching rates from ${carrierID}`);

        // Route to appropriate carrier function
        switch (carrierID) {
            case 'ESHIPPLUS':
                return await callCarrierFunction('getRatesEShipPlus', requestData);
                
            case 'CANPAR':
                return await callCarrierFunction('getRatesCanpar', requestData);
                
            case 'POLARISTRANSPORTATION':
                return await callCarrierFunction('getRatesPolarisTransportation', requestData);
                
            default:
                logger.warn(`Unsupported carrier: ${carrierID}`);
                return {
                    success: false,
                    error: `Carrier ${carrierID} is not supported for rate fetching`
                };
        }

    } catch (error) {
        logger.error(`Error fetching rates from ${carrier.carrierID}:`, error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * Call a carrier-specific cloud function
 */
async function callCarrierFunction(functionName, requestData) {
    try {
        // Import the specific carrier function
        let carrierFunction;
        
        switch (functionName) {
            case 'getRatesEShipPlus':
                carrierFunction = require('./carrier-api/eshipplus/getRates').getRatesEShipPlus;
                break;
            case 'getRatesCanpar':
                carrierFunction = require('./carrier-api/canpar/getRates').getRatesCanpar;
                break;
            case 'getRatesPolarisTransportation':
                carrierFunction = require('./carrier-api/polaristransportation/getRates').getRatesPolarisTransportation;
                break;
            default:
                throw new Error(`Unknown function: ${functionName}`);
        }

        // Call the function with proper context
        const result = await carrierFunction({ data: requestData, auth: { uid: 'system-universal-rates' } });
        
        return result;

    } catch (error) {
        logger.error(`Error calling ${functionName}:`, error);
        throw error;
    }
} 