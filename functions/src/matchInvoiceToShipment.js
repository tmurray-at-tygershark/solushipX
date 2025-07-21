const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const db = admin.firestore();

/**
 * Match invoice data to existing shipments with intelligent scoring
 */
const matchInvoiceToShipment = onCall({
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60
}, async (request) => {
    try {
        const { invoiceShipment, carrier, companyId } = request.data;
        const userId = request.auth?.uid;

        if (!userId) {
            throw new Error('Authentication required');
        }

        if (!invoiceShipment) {
            throw new Error('Invoice shipment data required');
        }

        logger.info('🔍 Starting shipment matching', {
            shipmentId: invoiceShipment.shipmentId,
            trackingNumber: invoiceShipment.trackingNumber,
            carrier: carrier?.name,
            companyId
        });

        // Get user's connected companies
        const connectedCompanies = await getUserConnectedCompanies(userId, companyId);

        // Find potential matches
        const potentialMatches = await findPotentialMatches(invoiceShipment, connectedCompanies, carrier);

        // Score and rank matches
        const scoredMatches = await scoreMatches(potentialMatches, invoiceShipment);

        // Create match result
        const matchResult = {
            invoiceShipment: invoiceShipment,
            matches: scoredMatches,
            bestMatch: scoredMatches.length > 0 ? scoredMatches[0] : null,
            confidence: scoredMatches.length > 0 ? scoredMatches[0].confidence : 0,
            status: determineMatchStatus(scoredMatches),
            reviewRequired: scoredMatches.length === 0 || scoredMatches[0].confidence < 0.85,
            carrierFiltered: carrier ? true : false,
            detectedCarrier: carrier?.name || 'Unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // Log match attempt
        await logMatchAttempt(matchResult, userId);

        return {
            success: true,
            matchResult
        };

    } catch (error) {
        logger.error('❌ Shipment matching error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Get user's connected companies
 */
async function getUserConnectedCompanies(userId, companyId) {
    const companies = new Set();
    
    if (companyId) {
        companies.add(companyId);
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        
        // Super admin sees all
        if (userData.role === 'superadmin') {
            return null; // No filtering
        }
        
        // Add connected companies
        if (userData.connectedCompanies) {
            userData.connectedCompanies.forEach(c => companies.add(c));
        }
        
        // Add company from user
        if (userData.companyId) {
            companies.add(userData.companyId);
        }
    }

    return Array.from(companies);
}

/**
 * Find potential matches using multiple strategies
 */
async function findPotentialMatches(invoiceShipment, connectedCompanies, carrier) {
    const matches = new Map();
    
    // Extract all possible identifiers
    const identifiers = extractIdentifiers(invoiceShipment);
    logger.info('📋 Extracted identifiers:', identifiers);

    // Strategy 1: Direct ICAL ID match
    if (identifiers.icalIds.length > 0) {
        await findByIcalId(matches, identifiers.icalIds, connectedCompanies, carrier);
    }

    // Strategy 2: Tracking number match
    if (identifiers.trackingNumbers.length > 0) {
        await findByTrackingNumber(matches, identifiers.trackingNumbers, connectedCompanies, carrier);
    }

    // Strategy 3: Reference number match
    if (identifiers.referenceNumbers.length > 0) {
        await findByReferenceNumber(matches, identifiers.referenceNumbers, connectedCompanies, carrier);
    }

    // Strategy 4: Date and amount correlation
    if (invoiceShipment.shipmentDate || invoiceShipment.shipDate) {
        await findByDateAndAmount(matches, invoiceShipment, connectedCompanies, carrier);
    }

    logger.info(`✅ Found ${matches.size} potential matches`);
    return Array.from(matches.values());
}

/**
 * Extract all possible identifiers from invoice data
 */
function extractIdentifiers(invoiceShipment) {
    const icalPattern = /\b(ICAL-[A-Z0-9]{6})\b/gi;
    const identifiers = {
        icalIds: [],
        trackingNumbers: [],
        referenceNumbers: []
    };

    // Extract ICAL IDs from all text fields
    const textFields = [
        invoiceShipment.shipmentId,
        invoiceShipment.description,
        invoiceShipment.notes,
        invoiceShipment.trackingNumber,
        invoiceShipment.bolNumber,
        invoiceShipment.references?.customerRef,
        invoiceShipment.references?.invoiceRef,
        ...(invoiceShipment.chargeDescriptions || [])
    ].filter(Boolean);

    textFields.forEach(field => {
        const matches = String(field).match(icalPattern);
        if (matches) {
            matches.forEach(match => {
                identifiers.icalIds.push(match.toUpperCase());
            });
        }
    });

    // Add tracking numbers
    if (invoiceShipment.trackingNumber) {
        identifiers.trackingNumbers.push(invoiceShipment.trackingNumber);
    }

    // Add reference numbers
    const refs = [
        invoiceShipment.referenceNumber,
        invoiceShipment.references?.customerRef,
        invoiceShipment.references?.invoiceRef,
        invoiceShipment.proNumber,
        invoiceShipment.bolNumber
    ].filter(Boolean);
    
    identifiers.referenceNumbers.push(...refs);

    // Remove duplicates
    identifiers.icalIds = [...new Set(identifiers.icalIds)];
    identifiers.trackingNumbers = [...new Set(identifiers.trackingNumbers)];
    identifiers.referenceNumbers = [...new Set(identifiers.referenceNumbers)];

    return identifiers;
}

/**
 * Find shipments by ICAL ID
 */
async function findByIcalId(matches, icalIds, connectedCompanies, carrier) {
    for (const icalId of icalIds) {
        try {
            // Direct document lookup
            const shipmentDoc = await db.collection('shipments').doc(icalId).get();
            if (shipmentDoc.exists) {
                const shipmentData = { id: shipmentDoc.id, ...shipmentDoc.data() };
                if (isAccessible(shipmentData, connectedCompanies) && isCarrierMatch(shipmentData, carrier)) {
                    matches.set(shipmentDoc.id, {
                        shipment: shipmentData,
                        matchStrategy: 'ICAL_ID_EXACT',
                        matchField: 'documentId',
                        matchValue: icalId,
                        confidence: 0.98
                    });
                }
            }

            // Also search shipmentID field
            const query = await db.collection('shipments')
                .where('shipmentID', '==', icalId)
                .limit(5)
                .get();

            query.docs.forEach(doc => {
                const shipmentData = { id: doc.id, ...doc.data() };
                if (isAccessible(shipmentData, connectedCompanies) && isCarrierMatch(shipmentData, carrier)) {
                    if (!matches.has(doc.id)) {
                        matches.set(doc.id, {
                            shipment: shipmentData,
                            matchStrategy: 'ICAL_ID_FIELD',
                            matchField: 'shipmentID',
                            matchValue: icalId,
                            confidence: 0.95
                        });
                    }
                }
            });
        } catch (error) {
            logger.warn(`Error searching ICAL ID ${icalId}:`, error);
        }
    }
}

/**
 * Find shipments by tracking number
 */
async function findByTrackingNumber(matches, trackingNumbers, connectedCompanies, carrier) {
    const trackingFields = [
        'trackingNumber',
        'carrierBookingConfirmation.trackingNumber',
        'carrierBookingConfirmation.proNumber',
        'shipmentInfo.carrierTrackingNumber'
    ];

    for (const trackingNumber of trackingNumbers) {
        for (const field of trackingFields) {
            try {
                const query = await db.collection('shipments')
                    .where(field, '==', trackingNumber)
                    .limit(5)
                    .get();

                query.docs.forEach(doc => {
                    const shipmentData = { id: doc.id, ...doc.data() };
                    if (isAccessible(shipmentData, connectedCompanies) && isCarrierMatch(shipmentData, carrier)) {
                        if (!matches.has(doc.id) || matches.get(doc.id).confidence < 0.90) {
                            matches.set(doc.id, {
                                shipment: shipmentData,
                                matchStrategy: 'TRACKING_NUMBER',
                                matchField: field,
                                matchValue: trackingNumber,
                                confidence: 0.90
                            });
                        }
                    }
                });
            } catch (error) {
                logger.warn(`Error searching tracking field ${field}:`, error);
            }
        }
    }
}

/**
 * Find shipments by reference number
 */
async function findByReferenceNumber(matches, referenceNumbers, connectedCompanies, carrier) {
    const referenceFields = [
        'shipmentInfo.shipperReferenceNumber',
        'shipmentInfo.customerReference',
        'referenceNumber',
        'shipperReferenceNumber',
        'references.customerRef',
        'references.invoiceRef'
    ];

    for (const reference of referenceNumbers) {
        for (const field of referenceFields) {
            try {
                const query = await db.collection('shipments')
                    .where(field, '==', reference)
                    .limit(5)
                    .get();

                query.docs.forEach(doc => {
                    const shipmentData = { id: doc.id, ...doc.data() };
                    if (isAccessible(shipmentData, connectedCompanies) && isCarrierMatch(shipmentData, carrier)) {
                        if (!matches.has(doc.id) || matches.get(doc.id).confidence < 0.85) {
                            matches.set(doc.id, {
                                shipment: shipmentData,
                                matchStrategy: 'REFERENCE_NUMBER',
                                matchField: field,
                                matchValue: reference,
                                confidence: 0.85
                            });
                        }
                    }
                });
            } catch (error) {
                logger.warn(`Error searching reference field ${field}:`, error);
            }
        }
    }
}

/**
 * Find shipments by date and amount
 */
async function findByDateAndAmount(matches, invoiceShipment, connectedCompanies, carrier) {
    if (!invoiceShipment.shipmentDate && !invoiceShipment.shipDate) return;
    
    try {
        const shipmentDate = new Date(invoiceShipment.shipmentDate || invoiceShipment.shipDate);
        const amount = parseFloat(invoiceShipment.totalAmount) || 0;
        
        // Search within ±3 days of the shipment date
        const startDate = new Date(shipmentDate.getTime() - 3 * 24 * 60 * 60 * 1000);
        const endDate = new Date(shipmentDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        
        const query = await db.collection('shipments')
            .where('bookedAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
            .where('bookedAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
            .limit(20)
            .get();
        
        query.docs.forEach(doc => {
            const shipmentData = { id: doc.id, ...doc.data() };
            if (isAccessible(shipmentData, connectedCompanies) && isCarrierMatch(shipmentData, carrier)) {
                // Check amount similarity (within 10%)
                const shipmentAmount = parseFloat(shipmentData.totalCharges || shipmentData.markupRates?.totalCharges || 0);
                if (shipmentAmount > 0 && amount > 0) {
                    const percentDiff = Math.abs(amount - shipmentAmount) / shipmentAmount;
                    if (percentDiff <= 0.10) {
                        if (!matches.has(doc.id)) {
                            matches.set(doc.id, {
                                shipment: shipmentData,
                                matchStrategy: 'DATE_AMOUNT',
                                matchField: 'date+amount',
                                matchValue: `${shipmentDate.toISOString().split('T')[0]} + $${amount}`,
                                confidence: 0.75 - (percentDiff * 2) // Better match = higher confidence
                            });
                        }
                    }
                }
            }
        });
    } catch (error) {
        logger.warn('Error in date/amount matching:', error);
    }
}

/**
 * Check if shipment is accessible to user
 */
function isAccessible(shipment, connectedCompanies) {
    if (!connectedCompanies) return true; // Super admin
    return connectedCompanies.includes(shipment.companyID) || 
           connectedCompanies.includes(shipment.companyId);
}

/**
 * Check if shipment matches carrier filter
 */
function isCarrierMatch(shipment, carrier) {
    if (!carrier || !carrier.name) return true;
    
    const shipmentCarrier = (
        shipment.selectedCarrier || 
        shipment.carrier || 
        shipment.carrierName || 
        ''
    ).toLowerCase();
    
    return shipmentCarrier.includes(carrier.name.toLowerCase());
}

/**
 * Score matches based on multiple factors
 */
async function scoreMatches(potentialMatches, invoiceShipment) {
    const scored = potentialMatches.map(match => {
        let score = match.confidence || 0.5;
        
        // Boost score for date proximity
        if (invoiceShipment.shipmentDate && match.shipment.bookedAt) {
            const invoiceDate = new Date(invoiceShipment.shipmentDate);
            const shipmentDate = match.shipment.bookedAt.toDate ? 
                match.shipment.bookedAt.toDate() : 
                new Date(match.shipment.bookedAt);
            
            const daysDiff = Math.abs(invoiceDate - shipmentDate) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 3) {
                score += 0.05;
            }
        }
        
        // Boost score for amount match
        if (invoiceShipment.totalAmount && match.shipment.totalCharges) {
            const amountDiff = Math.abs(invoiceShipment.totalAmount - match.shipment.totalCharges);
            const percentDiff = amountDiff / match.shipment.totalCharges;
            if (percentDiff < 0.05) {
                score += 0.05;
            }
        }
        
        return {
            ...match,
            confidence: Math.min(score, 1.0)
        };
    });
    
    return scored.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Determine match status based on confidence
 */
function determineMatchStatus(scoredMatches) {
    if (scoredMatches.length === 0) return 'NO_MATCH';
    
    const confidence = scoredMatches[0].confidence;
    if (confidence >= 0.95) return 'EXCELLENT';
    if (confidence >= 0.85) return 'GOOD';
    if (confidence >= 0.70) return 'FAIR';
    return 'POOR';
}

/**
 * Log match attempt for audit trail
 */
async function logMatchAttempt(matchResult, userId) {
    try {
        await db.collection('apMatchingLog').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId,
            invoiceShipmentId: matchResult.invoiceShipment.shipmentId,
            matchFound: matchResult.bestMatch !== null,
            confidence: matchResult.confidence,
            status: matchResult.status,
            carrierFiltered: matchResult.carrierFiltered,
            matchedShipmentId: matchResult.bestMatch?.shipment?.shipmentID
        });
    } catch (error) {
        logger.warn('Failed to log match attempt:', error);
    }
}

module.exports = { matchInvoiceToShipment }; 