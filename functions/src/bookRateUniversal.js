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

        // Check if the rate data is nested in a rateData field
        const actualRateData = selectedRate.rateData || selectedRate;
        console.log('bookRateUniversal: Using rate data for carrier determination:', JSON.stringify(actualRateData, null, 2));

        // Determine carrier from the rate data
        const carrier = determineCarrierFromRate(actualRateData);
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

        // FOLLOW QUICKSHIP PATTERN: Generate documents FIRST, then send emails with attachments
        // This ensures emails are sent after successful booking AND document generation
        try {
            console.log('bookRateUniversal: Starting document generation and notification process for advanced shipment');
            
            // Get the updated shipment document
            const shipmentDoc = await db.collection('shipments').doc(draftFirestoreDocId).get();
            if (!shipmentDoc.exists) {
                throw new Error('Shipment document not found after booking');
            }
            
            const shipmentData = shipmentDoc.data();
            const shipmentType = rateRequestData.shipmentInfo?.shipmentType || 'freight';
            
            console.log('bookRateUniversal: Document generation for shipment type:', shipmentType);
            
            // STEP 1: Generate documents based on shipment type (following QuickShip pattern)
            const documentResults = [];
            
            if (shipmentType === 'freight') {
                // For freight shipments: Generate BOL and Carrier Confirmation
                console.log('bookRateUniversal: Generating freight documents (BOL + Carrier Confirmation)');
                
                // Generate Generic BOL
                try {
                    const { generateBOLCore } = require('./carrier-api/generic/generateGenericBOL');
                    const bolResult = await generateBOLCore(shipmentData.shipmentID, draftFirestoreDocId);
                    documentResults.push({ type: 'bol', ...bolResult });
                    
                    console.log('bookRateUniversal: BOL generation completed:', {
                        success: bolResult.success,
                        hasData: !!bolResult.data,
                        hasDownloadUrl: !!bolResult.data?.downloadUrl,
                        downloadUrl: bolResult.data?.downloadUrl,
                        fileName: bolResult.data?.fileName,
                        error: bolResult.error,
                        fullBolResult: JSON.stringify(bolResult, null, 2)
                    });
                } catch (error) {
                    console.error('bookRateUniversal: Error generating BOL:', error);
                    documentResults.push({ type: 'bol', success: false, error: error.message });
                }
                
                // Generate Carrier Confirmation (if we have carrier details)
                const carrierDetails = {
                    name: bookingResult.data?.carrierName || shipmentData.carrier || 'Unknown Carrier',
                    contactEmail: shipmentData.carrierContactEmail || '',
                    contactName: shipmentData.carrierContactName || '',
                    contactPhone: shipmentData.carrierContactPhone || ''
                };
                
                // Always generate carrier confirmation for CreateShipmentX freight shipments
                try {
                    const { generateCarrierConfirmationCore } = require('./carrier-api/generic/generateCarrierConfirmation');
                    const confirmationResult = await generateCarrierConfirmationCore(
                        shipmentData.shipmentID, 
                        draftFirestoreDocId, 
                        carrierDetails
                    );
                    documentResults.push({ type: 'carrier_confirmation', ...confirmationResult });
                    
                    console.log('bookRateUniversal: Carrier Confirmation generation completed:', {
                        success: confirmationResult.success,
                        hasData: !!confirmationResult.data,
                        hasDownloadUrl: !!confirmationResult.data?.downloadUrl,
                        downloadUrl: confirmationResult.data?.downloadUrl,
                        fileName: confirmationResult.data?.fileName,
                        error: confirmationResult.error,
                        carrierDetails: carrierDetails,
                        fullConfirmationResult: JSON.stringify(confirmationResult, null, 2)
                    });
                } catch (error) {
                    console.error('bookRateUniversal: Error generating Carrier Confirmation:', error);
                    documentResults.push({ type: 'carrier_confirmation', success: false, error: error.message });
                }
                
            } else if (shipmentType === 'courier') {
                // For courier shipments: Generate shipping labels
                console.log('bookRateUniversal: Generating courier documents (shipping labels)');
                
                // The booking result should contain label information
                if (bookingResult.data?.shippingDocuments && bookingResult.data.shippingDocuments.length > 0) {
                    // Labels were already generated during booking process
                    documentResults.push({ 
                        type: 'shipping_label', 
                        success: true, 
                        data: { documents: bookingResult.data.shippingDocuments }
                    });
                    console.log('bookRateUniversal: Labels already generated during booking process');
                } else {
                    console.log('bookRateUniversal: No labels found in booking result for courier shipment');
                    documentResults.push({ 
                        type: 'shipping_label', 
                        success: false, 
                        error: 'No labels generated during booking process'
                    });
                }
            }
            
            // STEP 2: Wait for documents to be written to shipmentDocuments collection (QuickShip pattern)
            console.log('bookRateUniversal: Waiting for documents to be written to shipmentDocuments collection...');
            
            // Function to check for document existence in shipmentDocuments collection
            const waitForDocumentsInCollection = async (maxAttempts = 12, delayMs = 2500) => {
                let attempts = 0;
                
                while (attempts < maxAttempts) {
                    attempts++;
                    console.log(`bookRateUniversal: Document check attempt ${attempts}/${maxAttempts}`);
                    
                    let allExpectedDocsFound = true;
                    const foundDocs = [];
                    
                    // Check for expected documents based on what we tried to generate
                    for (const docResult of documentResults) {
                        if (docResult.success) {
                            let documentId;
                            if (docResult.type === 'bol') {
                                documentId = `${draftFirestoreDocId}_bol`;
                            } else if (docResult.type === 'carrier_confirmation') {
                                documentId = `${draftFirestoreDocId}_carrier_confirmation`;
                            } else {
                                // For other document types, skip collection check
                                continue;
                            }
                            
                            try {
                                const docSnapshot = await db.collection('shipmentDocuments').doc(documentId).get();
                                if (docSnapshot.exists) {
                                    const docData = docSnapshot.data();
                                    if (docData.downloadUrl) {
                                        console.log(`bookRateUniversal: Found ${docResult.type} in shipmentDocuments:`, {
                                            documentId,
                                            fileName: docData.fileName || docData.filename,
                                            hasDownloadUrl: !!docData.downloadUrl
                                        });
                                        
                                        // Update the document result with the actual collection data
                                        docResult.data = {
                                            ...docResult.data,
                                            downloadUrl: docData.downloadUrl,
                                            fileName: docData.fileName || docData.filename,
                                            documentId: documentId
                                        };
                                        foundDocs.push(docResult);
                                    } else {
                                        console.log(`bookRateUniversal: ${docResult.type} found but no downloadUrl yet`);
                                        allExpectedDocsFound = false;
                                        break;
                                    }
                                } else {
                                    console.log(`bookRateUniversal: ${docResult.type} not found in shipmentDocuments yet (${documentId})`);
                                    allExpectedDocsFound = false;
                                    break;
                                }
                            } catch (error) {
                                console.warn(`bookRateUniversal: Error checking ${docResult.type}:`, error.message);
                                allExpectedDocsFound = false;
                                break;
                            }
                        }
                    }
                    
                    if (allExpectedDocsFound) {
                        console.log('bookRateUniversal: All documents found in shipmentDocuments collection');
                        return true;
                    }
                    
                    if (attempts < maxAttempts) {
                        console.log(`bookRateUniversal: Documents not ready, waiting ${delayMs}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                }
                
                console.warn('bookRateUniversal: Documents may not be fully written to collection after maximum wait time');
                return false;
            };
            
            // Wait for documents to be written to the collection
            const documentsWritten = await waitForDocumentsInCollection();
            
            if (documentsWritten) {
                console.log('bookRateUniversal: All documents verified in shipmentDocuments collection');
            } else {
                console.warn('bookRateUniversal: Proceeding with notifications despite document collection concerns');
            }
            
            // Log final document status before sending notifications
            console.log('bookRateUniversal: Final document status before notifications:', 
                documentResults.map(doc => ({
                    type: doc.type,
                    success: doc.success,
                    hasDownloadUrl: !!doc.data?.downloadUrl,
                    fileName: doc.data?.fileName,
                    documentId: doc.data?.documentId
                }))
            );
            
            // STEP 3: Send notifications with document results (following QuickShip pattern)
            console.log('bookRateUniversal: Document generation completed, sending notifications with document results');
            
            const companyId = shipmentData.companyID || shipmentData.companyId || shipmentData.userCompanyId;
            
            if (companyId) {
                // CRITICAL FIX: Use the CORRECTED company ID for notifications
                console.log('bookRateUniversal: Using company ID for notifications:', companyId);
                console.log('bookRateUniversal: Full shipment data for notification debug:', {
                    shipmentId: shipmentData.shipmentID,
                    companyIdTypes: {
                        companyID: shipmentData.companyID,
                        companyId: shipmentData.companyId, 
                        userCompanyId: shipmentData.userCompanyId
                    },
                    createdBy: shipmentData.createdBy,
                    carrier: shipmentData.carrier
                });
                
                // Use CreateShipmentX-specific notification function (similar to QuickShip pattern)
                try {
                    // CRITICAL: Call the internal notification function directly, NOT the Cloud Function
                    // This follows the exact same pattern as QuickShip
                    const { sendCreateShipmentXNotificationsInternal } = require('./functions/generic/sendCreateShipmentXNotifications');
                    
                    // Call the internal function directly with shipment and document data
                    const notificationResult = await sendCreateShipmentXNotificationsInternal({
                        shipmentData: shipmentData,
                        documentResults: documentResults
                    });
                    
                    console.log('bookRateUniversal: CreateShipmentX notifications completed:', notificationResult);
                } catch (notificationError) {
                    console.error('bookRateUniversal: Error sending CreateShipmentX notifications:', notificationError);
                    
                    // Fallback to basic notification (without documents)
                    console.log('bookRateUniversal: Falling back to basic notification without documents');
                    const { sendNotificationEmail } = require('./email/sendgridService');
                    
                    await sendNotificationEmail(
                        'shipment_created',
                        companyId,
                        {
                            shipmentNumber: shipmentData.shipmentID || shipmentData.shipmentNumber,
                            carrierName: shipmentData.carrier || carrier || 'Unknown Carrier',
                            trackingNumber: shipmentData.trackingNumber || shipmentData.shipmentID,
                            shipFrom: `${shipmentData.shipFrom?.companyName || shipmentData.shipFrom?.company || 'Unknown'}, ${shipmentData.shipFrom?.city || 'Unknown'}`,
                            shipTo: `${shipmentData.shipTo?.companyName || shipmentData.shipTo?.company || 'Unknown'}, ${shipmentData.shipTo?.city || 'Unknown'}`,
                            totalCharges: shipmentData.totalCharges || 0,
                            currency: shipmentData.currency || 'CAD',
                            createdAt: new Date().toLocaleDateString()
                        }
                    );
                    console.log('bookRateUniversal: Basic email notifications sent successfully');
                }
            } else {
                console.warn('bookRateUniversal: No company ID found for email notifications');
            }
            
        } catch (emailError) {
            console.error('bookRateUniversal: Error in document generation and notification process:', emailError);
            // Don't fail the entire booking process for email/document errors
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
        console.log('determineCarrierFromRate: sourceCarrier object:', JSON.stringify(sourceCarrierObj, null, 2));
        
        if (sourceSystem === 'eshipplus' || sourceSystem === 'eship') {
            console.log('determineCarrierFromRate: Routing to eShipPlus based on sourceCarrier.system');
            return 'eshipplus';
        }
        if (sourceSystem === 'canpar') {
            console.log('determineCarrierFromRate: Routing to Canpar based on sourceCarrier.system');
            return 'canpar';
        }
        if (sourceSystem === 'polaristransportation' || sourceSystem === 'polaris' || sourceSystem.includes('polaris')) {
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
    
    // PRIORITY 4: Check _source field (another common pattern)
    if (selectedRate._source) {
        const sourceSystem = selectedRate._source.toLowerCase().trim();
        console.log('determineCarrierFromRate: Found _source field:', sourceSystem);
        
        if (sourceSystem === 'eshipplus' || sourceSystem === 'eship') {
            console.log('determineCarrierFromRate: Routing to eShipPlus based on _source');
            return 'eshipplus';
        }
        if (sourceSystem === 'canpar') {
            console.log('determineCarrierFromRate: Routing to Canpar based on _source');
            return 'canpar';
        }
        if (sourceSystem === 'polaristransportation' || sourceSystem === 'polaris' || sourceSystem.includes('polaris')) {
            console.log('determineCarrierFromRate: Routing to Polaris Transportation based on _source');
            return 'polaristransportation';
        }
    }

    // PRIORITY 5: Fallback to checking various carrier fields (legacy support)
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
        if (field) {
            let carrier;
            
            // Handle carrier objects (like {name: 'Polaris Transportation', id: 'POLARISTRANSPORTATION'})
            if (typeof field === 'object' && field !== null) {
                carrier = (field.name || field.id || field.key || field.scac || '').toLowerCase().trim();
                console.log('determineCarrierFromRate: Checking carrier object field:', carrier, 'from', JSON.stringify(field, null, 2));
            } else if (typeof field === 'string' && field.trim()) {
                carrier = field.trim().toLowerCase();
                console.log('determineCarrierFromRate: Checking carrier string field:', carrier);
            } else {
                continue;
            }
            
            if (carrier) {
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
    }

    throw new Error('Unable to determine carrier from rate data - no source carrier or recognizable carrier found');
} 