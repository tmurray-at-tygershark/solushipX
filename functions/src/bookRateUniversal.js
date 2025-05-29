const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { bookEShipPlusShipment } = require('./carrier-api/eshipplus/bookRate');
const { bookCanparShipment } = require('./carrier-api/canpar/bookRate');

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
                bookingResult = await bookEShipPlusShipment(rateRequestData, draftFirestoreDocId, selectedRateDocumentId);
                break;

            case 'canpar':
                console.log('bookRateUniversal: Routing to Canpar booking');
                bookingResult = await bookCanparShipment(rateRequestData, draftFirestoreDocId, selectedRateDocumentId);
                break;

            default:
                throw new HttpsError('invalid-argument', `Unsupported carrier for booking: ${carrier}`);
        }

        console.log('bookRateUniversal: Booking completed successfully');
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
    }
    
    // PRIORITY 2: Check legacy sourceCarrier field
    if (selectedRate.sourceCarrier) {
        const sourceCarrier = selectedRate.sourceCarrier.toLowerCase().trim();
        console.log('determineCarrierFromRate: Found sourceCarrier:', sourceCarrier);
        
        if (sourceCarrier === 'eshipplus' || sourceCarrier === 'eship') {
            console.log('determineCarrierFromRate: Routing to eShipPlus based on sourceCarrier');
            return 'eshipplus';
        }
        if (sourceCarrier === 'canpar') {
            console.log('determineCarrierFromRate: Routing to Canpar based on sourceCarrier');
            return 'canpar';
        }
    }
    
    // PRIORITY 3: Fallback to checking various carrier fields (legacy support)
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
            
            // If no specific mapping found, this might be a sub-carrier
            // Log warning but don't return yet - check other fields
            console.warn('determineCarrierFromRate: Found carrier but no mapping:', carrier);
        }
    }

    throw new Error('Unable to determine carrier from rate data - no source carrier or recognizable carrier found');
} 