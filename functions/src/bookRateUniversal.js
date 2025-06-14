const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { bookEShipPlusShipment } = require('./carrier-api/eshipplus/bookRate');
const { bookCanparShipment } = require('./carrier-api/canpar/bookRate');
const { bookPolarisTransportationShipment } = require('./carrier-api/polaristransportation/bookRate');
const { recordShipmentEvent, EVENT_TYPES, EVENT_SOURCES } = require('./utils/shipmentEvents');

// Get Firestore instance
const db = admin.firestore();

/**
 * Universal booking function that routes to the appropriate carrier
 * Based on the selected rate's carrier information
 */
exports.bookRateUniversal = onCall(async (request) => {
    console.log('bookRateUniversal: Starting universal booking process');
    console.log('bookRateUniversal: Request data:', JSON.stringify(request.data, null, 2));

    try {
        const { rateRequestData, draftFirestoreDocId, selectedRateDocumentId } = request.data;

        // Validate required parameters
        if (!rateRequestData) {
            throw new HttpsError('invalid-argument', 'rateRequestData is required');
        }
        if (!draftFirestoreDocId) {
            throw new HttpsError('invalid-argument', 'draftFirestoreDocId is required');
        }
        if (!selectedRateDocumentId) {
            throw new HttpsError('invalid-argument', 'selectedRateDocumentId is required');
        }

        // Get the selected rate to determine which carrier to use
        const rateDoc = await db.collection('shipmentRates').doc(selectedRateDocumentId).get();
        if (!rateDoc.exists) {
            throw new HttpsError('not-found', `Selected rate document ${selectedRateDocumentId} not found`);
        }

        const selectedRate = rateDoc.data();
        console.log('bookRateUniversal: Retrieved selected rate:', JSON.stringify(selectedRate, null, 2));

        // Determine carrier from the rate data
        const carrier = determineCarrierFromRate(selectedRate);
        console.log('bookRateUniversal: Determined carrier:', carrier);

        let bookingResult;

        // Route to appropriate carrier booking function
        switch (carrier.toLowerCase()) {
            case 'eshipplus':
            case 'eship':
                console.log('bookRateUniversal: Routing to eShipPlus booking');
                
                // Transform packages to Items array for eShipPlus
                const transformedRateRequestData = {
                    ...rateRequestData,
                    // Transform Origin address
                    Origin: {
                        Description: rateRequestData.Origin?.Description || rateRequestData.shipFrom?.company || rateRequestData.shipFrom?.name || '',
                        Street: rateRequestData.Origin?.Street || rateRequestData.shipFrom?.street || '',
                        StreetExtra: rateRequestData.Origin?.StreetExtra || rateRequestData.shipFrom?.street2 || '',
                        PostalCode: rateRequestData.Origin?.PostalCode || rateRequestData.shipFrom?.postalCode || rateRequestData.shipFrom?.zipPostal || '',
                        City: rateRequestData.Origin?.City || rateRequestData.shipFrom?.city || '',
                        State: rateRequestData.Origin?.State || rateRequestData.shipFrom?.state || '',
                        Country: rateRequestData.Origin?.Country || { 
                            Code: rateRequestData.shipFrom?.country || 'US',
                            Name: rateRequestData.shipFrom?.country === 'CA' ? 'Canada' : 'United States',
                            UsesPostalCode: true
                        },
                        Contact: rateRequestData.Origin?.Contact || rateRequestData.shipFrom?.contactName || rateRequestData.shipFrom?.attention || '',
                        Phone: rateRequestData.Origin?.Phone || rateRequestData.shipFrom?.phone || rateRequestData.shipFrom?.contactPhone || '',
                        Email: rateRequestData.Origin?.Email || rateRequestData.shipFrom?.email || rateRequestData.shipFrom?.contactEmail || '',
                        Fax: rateRequestData.Origin?.Fax || '',
                        Mobile: rateRequestData.Origin?.Mobile || '',
                        SpecialInstructions: rateRequestData.Origin?.SpecialInstructions || rateRequestData.shipFrom?.specialInstructions || 'none'
                    },
                    // Transform Destination address
                    Destination: {
                        Description: rateRequestData.Destination?.Description || rateRequestData.shipTo?.company || rateRequestData.shipTo?.name || '',
                        Street: rateRequestData.Destination?.Street || rateRequestData.shipTo?.street || '',
                        StreetExtra: rateRequestData.Destination?.StreetExtra || rateRequestData.shipTo?.street2 || '',
                        PostalCode: rateRequestData.Destination?.PostalCode || rateRequestData.shipTo?.postalCode || rateRequestData.shipTo?.zipPostal || '',
                        City: rateRequestData.Destination?.City || rateRequestData.shipTo?.city || '',
                        State: rateRequestData.Destination?.State || rateRequestData.shipTo?.state || '',
                        Country: rateRequestData.Destination?.Country || { 
                            Code: rateRequestData.shipTo?.country || 'US',
                            Name: rateRequestData.shipTo?.country === 'CA' ? 'Canada' : 'United States',
                            UsesPostalCode: true
                        },
                        Contact: rateRequestData.Destination?.Contact || rateRequestData.shipTo?.contactName || rateRequestData.shipTo?.attention || '',
                        Phone: rateRequestData.Destination?.Phone || rateRequestData.shipTo?.phone || rateRequestData.shipTo?.contactPhone || '',
                        Email: rateRequestData.Destination?.Email || rateRequestData.shipTo?.email || rateRequestData.shipTo?.contactEmail || '',
                        Fax: rateRequestData.Destination?.Fax || '',
                        Mobile: rateRequestData.Destination?.Mobile || '',
                        SpecialInstructions: rateRequestData.Destination?.SpecialInstructions || rateRequestData.shipTo?.specialInstructions || 'none'
                    },
                    Items: (rateRequestData.packages || []).map(pkg => ({
                        Weight: parseFloat(pkg.weight) || 0,
                        PackagingQuantity: parseInt(pkg.packagingQuantity || pkg.quantity) || 1,
                        SaidToContain: parseInt(pkg.saidToContain || pkg.packagingQuantity || pkg.quantity) || 1,
                        Height: parseFloat(pkg.height) || 0,
                        Width: parseFloat(pkg.width) || 0,
                        Length: parseFloat(pkg.length) || 0,
                        Stackable: typeof pkg.stackable === 'boolean' ? pkg.stackable : true,
                        HazardousMaterial: pkg.hazardous || false,
                        DeclaredValue: parseFloat(pkg.declaredValue || pkg.value) || 0,
                        Description: pkg.itemDescription || pkg.description || "Package",
                        Comment: "",
                        NationalMotorFreightClassification: "",
                        HarmonizedTariffSchedule: "",
                        Packaging: {
                            Key: parseInt(pkg.packaging?.key || pkg.packaging?.PackagingType) || 258,
                            PackageName: pkg.packaging?.PackageName || "Pallets",
                            DefaultLength: parseFloat(pkg.packaging?.DefaultLength) || 0,
                            DefaultHeight: parseFloat(pkg.packaging?.DefaultHeight) || 0,
                            DefaultWidth: parseFloat(pkg.packaging?.DefaultWidth) || 0
                        },
                        FreightClass: {
                            FreightClass: parseFloat(pkg.freightClass) || 50.0
                        }
                    }))
                };
                
                bookingResult = await bookEShipPlusShipment(transformedRateRequestData, draftFirestoreDocId, selectedRateDocumentId);
                break;

            case 'canpar':
                console.log('bookRateUniversal: Routing to Canpar booking');
                bookingResult = await bookCanparShipment(rateRequestData, draftFirestoreDocId, selectedRateDocumentId);
                break;

            case 'polaristransportation':
            case 'polaris':
            case 'polaristransport':
                console.log('bookRateUniversal: Routing to Polaris Transportation booking');
                bookingResult = await bookPolarisTransportationShipment(rateRequestData, draftFirestoreDocId, selectedRateDocumentId);
                break;

            default:
                throw new HttpsError('invalid-argument', `Unsupported carrier for booking: ${carrier}`);
        }

        console.log('bookRateUniversal: Booking completed successfully');
        
        // Record the booking confirmation event
        try {
            await recordShipmentEvent(
                draftFirestoreDocId,
                EVENT_TYPES.BOOKING_CONFIRMED,
                'Shipment Booking Confirmed',
                `Shipment successfully booked with ${carrier}. Tracking information and documents will be available shortly.`,
                EVENT_SOURCES.SYSTEM,
                null, // No specific user context in this function
                { carrier: carrier, selectedRateId: selectedRateDocumentId }
            );
        } catch (eventError) {
            console.error('Error recording booking confirmation event:', eventError);
            // Don't fail the entire booking process for event recording errors
        }
        
        return bookingResult;

    } catch (error) {
        console.error('bookRateUniversal: Error during booking process:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Booking failed: ${error.message}`);
    }
});

/**
 * Determines the carrier from rate data
 * CRITICAL: Checks source carrier system first to ensure proper routing
 * For eShipPlus rates, this prevents routing to individual carriers like FedEx/UPS
 */
function determineCarrierFromRate(selectedRate) {
    console.log('determineCarrierFromRate: Analyzing rate data for carrier routing');
    console.log('determineCarrierFromRate: Rate data:', JSON.stringify(selectedRate, null, 2));
    
    // PRIORITY 1: Check for source carrier system (added by rate fetching process)
    // This ensures eShipPlus rates always route to eShipPlus regardless of individual carrier
    if (selectedRate.sourceCarrierSystem) {
        const sourceSystem = selectedRate.sourceCarrierSystem.toLowerCase().trim();
        console.log('determineCarrierFromRate: Found sourceCarrierSystem:', sourceSystem);
        
        if (sourceSystem === 'eshipplus' || sourceSystem === 'eship') {
            console.log('determineCarrierFromRate: Routing to eShipPlus based on sourceCarrierSystem');
            return 'eshipplus';
        }
        if (sourceSystem === 'canpar') {
            console.log('determineCarrierFromRate: Routing to Canpar based on sourceCarrierSystem');
            return 'canpar';
        }
        if (sourceSystem === 'polaristransportation' || sourceSystem === 'polaris') {
            console.log('determineCarrierFromRate: Routing to Polaris Transportation based on sourceCarrierSystem');
            return 'polaristransportation';
        }
    }
    
    // PRIORITY 2: Check sourceCarrier object (modern format from frontend translator)
    if (selectedRate.sourceCarrier && typeof selectedRate.sourceCarrier === 'object') {
        const sourceCarrierObj = selectedRate.sourceCarrier;
        const sourceSystem = (sourceCarrierObj.system || sourceCarrierObj.key || sourceCarrierObj.name || '').toLowerCase().trim();
        console.log('determineCarrierFromRate: Found sourceCarrier object with system:', sourceSystem);
        
        if (sourceSystem === 'eshipplus' || sourceSystem === 'eship') {
            console.log('determineCarrierFromRate: Routing to eShipPlus based on sourceCarrier.system');
            return 'eshipplus';
        }
        if (sourceSystem === 'canpar') {
            console.log('determineCarrierFromRate: Routing to Canpar based on sourceCarrier.system');
            return 'canpar';
        }
        if (sourceSystem === 'polaristransportation' || sourceSystem === 'polaris') {
            console.log('determineCarrierFromRate: Routing to Polaris Transportation based on sourceCarrier.system');
            return 'polaristransportation';
        }
    }
    
    // PRIORITY 3: Check legacy sourceCarrier field (string format)
    if (selectedRate.sourceCarrier && typeof selectedRate.sourceCarrier === 'string') {
        const sourceCarrier = selectedRate.sourceCarrier.toLowerCase().trim();
        console.log('determineCarrierFromRate: Found legacy sourceCarrier string:', sourceCarrier);
        
        if (sourceCarrier === 'eshipplus' || sourceCarrier === 'eship') {
            console.log('determineCarrierFromRate: Routing to eShipPlus based on legacy sourceCarrier');
            return 'eshipplus';
        }
        if (sourceCarrier === 'canpar') {
            console.log('determineCarrierFromRate: Routing to Canpar based on legacy sourceCarrier');
            return 'canpar';
        }
        if (sourceCarrier === 'polaristransportation' || sourceCarrier === 'polaris') {
            console.log('determineCarrierFromRate: Routing to Polaris Transportation based on legacy sourceCarrier');
            return 'polaristransportation';
        }
    }
    
    // PRIORITY 4: Fallback to checking various carrier fields (legacy support)
    console.log('determineCarrierFromRate: No source carrier found, falling back to carrier name detection');
    const carrierFields = [
        selectedRate.carrier,
        selectedRate.carrierName,
        selectedRate.carrierCode,
        selectedRate.carrierId
    ];

    // Check universal format
    if (selectedRate.universalRateData?.carrier?.name) {
        carrierFields.push(selectedRate.universalRateData.carrier.name);
    }
    if (selectedRate.universalRateData?.carrier?.id) {
        carrierFields.push(selectedRate.universalRateData.carrier.id);
    }

    // Find the first non-empty carrier identifier
    for (const field of carrierFields) {
        if (field && typeof field === 'string' && field.trim()) {
            const carrier = field.trim().toLowerCase();
            console.log('determineCarrierFromRate: Checking carrier field:', carrier);
            
            // Map various carrier identifiers to standard names
            if (carrier.includes('eshipplus') || carrier.includes('eship')) {
                console.log('determineCarrierFromRate: Routing to eShipPlus based on carrier name');
                return 'eshipplus';
            }
            if (carrier.includes('canpar')) {
                console.log('determineCarrierFromRate: Routing to Canpar based on carrier name');
                return 'canpar';
            }
            if (carrier.includes('polaris') || carrier.includes('polaristransportation')) {
                console.log('determineCarrierFromRate: Routing to Polaris Transportation based on carrier name');
                return 'polaristransportation';
            }
            
            // If no specific mapping found, this might be a sub-carrier
            // Log warning but don't return yet - check other fields
            console.warn('determineCarrierFromRate: Found carrier but no mapping:', carrier);
        }
    }

    throw new Error('Unable to determine carrier from rate data - no source carrier or recognizable carrier found');
} 