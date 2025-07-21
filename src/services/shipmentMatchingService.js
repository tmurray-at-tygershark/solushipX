import { db } from '../firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    limit,
    orderBy 
} from 'firebase/firestore';

/**
 * Shipment Matching Service for AP Processing
 * Intelligently matches carrier invoice data to existing shipments
 */

// Matching confidence thresholds
const CONFIDENCE_THRESHOLDS = {
    EXCELLENT: 0.95,    // Auto-apply
    GOOD: 0.85,         // Review recommended  
    FAIR: 0.70,         // Manual review required
    POOR: 0.50          // Likely no match
};

// Matching strategies with weights
const MATCHING_STRATEGIES = {
    EXACT_SHIPMENT_ID: { weight: 100, confidence: 0.98 },
    EXACT_TRACKING_NUMBER: { weight: 90, confidence: 0.95 },
    EXACT_BOOKING_REFERENCE: { weight: 85, confidence: 0.92 },
    REFERENCE_NUMBER_MATCH: { weight: 70, confidence: 0.80 },
    DATE_AMOUNT_MATCH: { weight: 60, confidence: 0.75 },
    FUZZY_REFERENCE_MATCH: { weight: 40, confidence: 0.65 },
    CARRIER_DATE_MATCH: { weight: 30, confidence: 0.55 }
};

/**
 * Main matching function - finds shipments that match invoice data
 * @param {Object} invoiceData - Extracted invoice data from AP processing
 * @param {Array} connectedCompanies - Company IDs user has access to
 * @returns {Promise<Object>} Matching results with confidence scores
 */
export const matchShipmentsToInvoice = async (invoiceData, connectedCompanies = []) => {
    try {
        console.log('🔍 Starting shipment matching for invoice:', invoiceData.metadata?.documentNumber);
        
        const matches = [];
        const shipments = invoiceData.shipments || [];
        
        for (const invoiceShipment of shipments) {
            console.log('🔍 Processing shipment:', invoiceShipment.trackingNumber || invoiceShipment.references?.customerRef);
            
            // Try multiple matching strategies
            const potentialMatches = await findPotentialMatches(invoiceShipment, connectedCompanies);
            
            // Score and rank matches
            const scoredMatches = await scoreMatches(potentialMatches, invoiceShipment);
            
            // Create match result
            const matchResult = {
                invoiceShipment: invoiceShipment,
                matches: scoredMatches,
                bestMatch: scoredMatches.length > 0 ? scoredMatches[0] : null,
                confidence: scoredMatches.length > 0 ? scoredMatches[0].confidence : 0,
                status: determineMatchStatus(scoredMatches),
                reviewRequired: scoredMatches.length === 0 || scoredMatches[0].confidence < CONFIDENCE_THRESHOLDS.GOOD,
                timestamp: new Date().toISOString()
            };
            
            matches.push(matchResult);
        }
        
        // Calculate overall matching statistics
        const stats = calculateMatchingStats(matches);
        
        console.log('🎯 Matching completed:', stats);
        
        return {
            success: true,
            matches: matches,
            stats: stats,
            requiresReview: matches.some(m => m.reviewRequired),
            autoApplicable: matches.filter(m => !m.reviewRequired).length
        };
        
    } catch (error) {
        console.error('❌ Error in shipment matching:', error);
        return {
            success: false,
            error: error.message,
            matches: []
        };
    }
};

/**
 * Find potential shipment matches using multiple strategies
 */
async function findPotentialMatches(invoiceShipment, connectedCompanies) {
    const potentialMatches = new Set(); // Use Set to avoid duplicates
    const shipmentsRef = collection(db, 'shipments');
    
    // Strategy 1: Exact shipment ID match
    await tryExactMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies, 'shipmentID');
    
    // Strategy 2: Exact tracking number match
    if (invoiceShipment.trackingNumber) {
        await tryTrackingNumberMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies);
    }
    
    // Strategy 3: Booking reference match (eShipPlus, etc.)
    if (invoiceShipment.references?.invoiceRef || invoiceShipment.references?.customerRef) {
        await tryBookingReferenceMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies);
    }
    
    // Strategy 4: Reference number variations
    if (invoiceShipment.references) {
        await tryReferenceNumberMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies);
    }
    
    // Strategy 5: Date and amount correlation
    await tryDateAmountMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies);
    
    return Array.from(potentialMatches);
}

/**
 * Try exact field matching
 */
async function tryExactMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies, field) {
    const searchValue = invoiceShipment[field] || invoiceShipment.references?.[field];
    if (!searchValue) return;
    
    try {
        // Try multiple field variations
        const fieldVariations = getFieldVariations(field);
        
        for (const fieldName of fieldVariations) {
            const q = query(
                shipmentsRef,
                where(fieldName, '==', searchValue),
                limit(10)
            );
            
            const snapshot = await getDocs(q);
            snapshot.docs.forEach(doc => {
                const shipmentData = { id: doc.id, ...doc.data() };
                if (isCompanyAccessible(shipmentData, connectedCompanies)) {
                    potentialMatches.add(JSON.stringify({
                        shipment: shipmentData,
                        matchStrategy: `EXACT_${field.toUpperCase()}`,
                        matchField: fieldName,
                        matchValue: searchValue
                    }));
                }
            });
        }
    } catch (error) {
        console.warn(`Warning: Could not search by ${field}:`, error);
    }
}

/**
 * Try tracking number matching with multiple field locations
 */
async function tryTrackingNumberMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies) {
    const trackingNumber = invoiceShipment.trackingNumber;
    
    const trackingFields = [
        'trackingNumber',
        'carrierBookingConfirmation.trackingNumber',
        'carrierBookingConfirmation.proNumber',
        'carrierBookingConfirmation.confirmationNumber',
        'selectedRate.TrackingNumber',
        'selectedRate.Barcode',
        'selectedRateRef.TrackingNumber', 
        'selectedRateRef.Barcode',
        'bookingReferenceNumber'
    ];
    
    for (const field of trackingFields) {
        try {
            const q = query(
                shipmentsRef,
                where(field, '==', trackingNumber),
                limit(5)
            );
            
            const snapshot = await getDocs(q);
            snapshot.docs.forEach(doc => {
                const shipmentData = { id: doc.id, ...doc.data() };
                if (isCompanyAccessible(shipmentData, connectedCompanies)) {
                    potentialMatches.add(JSON.stringify({
                        shipment: shipmentData,
                        matchStrategy: 'EXACT_TRACKING_NUMBER',
                        matchField: field,
                        matchValue: trackingNumber
                    }));
                }
            });
        } catch (error) {
            console.warn(`Warning: Could not search tracking field ${field}:`, error);
        }
    }
}

/**
 * Try booking reference matching
 */
async function tryBookingReferenceMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies) {
    const references = [
        invoiceShipment.references?.invoiceRef,
        invoiceShipment.references?.customerRef,
        invoiceShipment.references?.manifestRef,
        ...(invoiceShipment.references?.other || [])
    ].filter(Boolean);
    
    const bookingFields = [
        'selectedRate.BookingReferenceNumber',
        'selectedRateRef.BookingReferenceNumber',
        'bookingReferenceNumber',
        'carrierBookingConfirmation.bookingReferenceNumber',
        'referenceNumber',
        'shipperReferenceNumber'
    ];
    
    for (const reference of references) {
        for (const field of bookingFields) {
            try {
                const q = query(
                    shipmentsRef,
                    where(field, '==', reference),
                    limit(5)
                );
                
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(doc => {
                    const shipmentData = { id: doc.id, ...doc.data() };
                    if (isCompanyAccessible(shipmentData, connectedCompanies)) {
                        potentialMatches.add(JSON.stringify({
                            shipment: shipmentData,
                            matchStrategy: 'EXACT_BOOKING_REFERENCE',
                            matchField: field,
                            matchValue: reference
                        }));
                    }
                });
            } catch (error) {
                console.warn(`Warning: Could not search booking field ${field}:`, error);
            }
        }
    }
}

/**
 * Try reference number matching with fuzzy logic
 */
async function tryReferenceNumberMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies) {
    // Get all reference numbers from invoice
    const allReferences = [
        invoiceShipment.references?.customerRef,
        invoiceShipment.references?.invoiceRef,
        invoiceShipment.references?.manifestRef,
        ...(invoiceShipment.references?.other || [])
    ].filter(Boolean);
    
    const referenceFields = [
        'shipmentInfo.shipperReferenceNumber',
        'shipmentInfo.customerReference',
        'shipmentInfo.referenceNumber',
        'referenceNumber',
        'shipperReferenceNumber'
    ];
    
    for (const reference of allReferences) {
        for (const field of referenceFields) {
            try {
                const q = query(
                    shipmentsRef,
                    where(field, '==', reference),
                    limit(3)
                );
                
                const snapshot = await getDocs(q);
                snapshot.docs.forEach(doc => {
                    const shipmentData = { id: doc.id, ...doc.data() };
                    if (isCompanyAccessible(shipmentData, connectedCompanies)) {
                        potentialMatches.add(JSON.stringify({
                            shipment: shipmentData,
                            matchStrategy: 'REFERENCE_NUMBER_MATCH',
                            matchField: field,
                            matchValue: reference
                        }));
                    }
                });
            } catch (error) {
                console.warn(`Warning: Could not search reference field ${field}:`, error);
            }
        }
    }
}

/**
 * Try date and amount correlation matching
 */
async function tryDateAmountMatch(potentialMatches, shipmentsRef, invoiceShipment, connectedCompanies) {
    if (!invoiceShipment.shipmentDate && !invoiceShipment.totalAmount) return;
    
    try {
        // Look for shipments around the same date with similar amounts
        const shipmentDate = new Date(invoiceShipment.shipmentDate);
        const amount = invoiceShipment.totalAmount;
        
        // Search within ±3 days of the shipment date
        const startDate = new Date(shipmentDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(shipmentDate);
        endDate.setDate(endDate.getDate() + 3);
        
        const q = query(
            shipmentsRef,
            where('bookedAt', '>=', startDate),
            where('bookedAt', '<=', endDate),
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
            const shipmentData = { id: doc.id, ...doc.data() };
            if (isCompanyAccessible(shipmentData, connectedCompanies)) {
                // Check if amounts are similar (within 10%)
                const shipmentAmount = getShipmentTotalAmount(shipmentData);
                if (shipmentAmount > 0 && Math.abs(amount - shipmentAmount) / shipmentAmount < 0.1) {
                    potentialMatches.add(JSON.stringify({
                        shipment: shipmentData,
                        matchStrategy: 'DATE_AMOUNT_MATCH',
                        matchField: 'bookedAt + amount',
                        matchValue: `${shipmentDate.toISOString().split('T')[0]} + $${amount}`
                    }));
                }
            }
        });
        
    } catch (error) {
        console.warn('Warning: Could not perform date/amount matching:', error);
    }
}

/**
 * Score potential matches and calculate confidence
 */
async function scoreMatches(potentialMatches, invoiceShipment) {
    const scoredMatches = [];
    
    // Parse potential matches from JSON strings and remove duplicates
    const uniqueMatches = new Map();
    
    potentialMatches.forEach(matchStr => {
        try {
            const match = JSON.parse(matchStr);
            const key = match.shipment.id;
            
            if (!uniqueMatches.has(key) || 
                MATCHING_STRATEGIES[match.matchStrategy]?.weight > 
                MATCHING_STRATEGIES[uniqueMatches.get(key).matchStrategy]?.weight) {
                uniqueMatches.set(key, match);
            }
        } catch (error) {
            console.warn('Error parsing match:', error);
        }
    });
    
    // Score each unique match
    for (const match of uniqueMatches.values()) {
        const confidence = calculateMatchConfidence(match, invoiceShipment);
        
        scoredMatches.push({
            shipment: match.shipment,
            matchStrategy: match.matchStrategy,
            matchField: match.matchField,
            matchValue: match.matchValue,
            confidence: confidence,
            details: generateMatchDetails(match, invoiceShipment)
        });
    }
    
    // Sort by confidence (highest first)
    return scoredMatches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculate match confidence score
 */
function calculateMatchConfidence(match, invoiceShipment) {
    let confidence = MATCHING_STRATEGIES[match.matchStrategy]?.confidence || 0.5;
    
    // Boost confidence for additional matching factors
    
    // Date proximity bonus
    if (match.shipment.bookedAt && invoiceShipment.shipmentDate) {
        const shipmentDate = new Date(match.shipment.bookedAt.toDate ? match.shipment.bookedAt.toDate() : match.shipment.bookedAt);
        const invoiceDate = new Date(invoiceShipment.shipmentDate);
        const daysDiff = Math.abs((shipmentDate - invoiceDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) confidence += 0.05;
        else if (daysDiff <= 3) confidence += 0.02;
    }
    
    // Amount proximity bonus
    if (invoiceShipment.totalAmount > 0) {
        const shipmentAmount = getShipmentTotalAmount(match.shipment);
        if (shipmentAmount > 0) {
            const amountDiff = Math.abs(invoiceShipment.totalAmount - shipmentAmount) / shipmentAmount;
            if (amountDiff <= 0.05) confidence += 0.05; // Within 5%
            else if (amountDiff <= 0.10) confidence += 0.02; // Within 10%
        }
    }
    
    // Carrier consistency bonus
    if (invoiceShipment.carrier && match.shipment.carrier) {
        if (invoiceShipment.carrier.toLowerCase().includes(match.shipment.carrier.toLowerCase()) ||
            match.shipment.carrier.toLowerCase().includes(invoiceShipment.carrier.toLowerCase())) {
            confidence += 0.03;
        }
    }
    
    // Service type consistency bonus
    if (invoiceShipment.serviceType && 
        (match.shipment.selectedRate?.serviceType || match.shipment.serviceType)) {
        const shipmentService = match.shipment.selectedRate?.serviceType || match.shipment.serviceType;
        if (invoiceShipment.serviceType.toLowerCase().includes(shipmentService.toLowerCase()) ||
            shipmentService.toLowerCase().includes(invoiceShipment.serviceType.toLowerCase())) {
            confidence += 0.02;
        }
    }
    
    return Math.min(confidence, 0.99); // Cap at 99%
}

/**
 * Helper functions
 */
function getFieldVariations(field) {
    const variations = {
        'shipmentID': ['shipmentID', 'shipmentId', 'id'],
        'trackingNumber': ['trackingNumber', 'tracking', 'barcode'],
        'referenceNumber': ['referenceNumber', 'ref', 'reference']
    };
    
    return variations[field] || [field];
}

function isCompanyAccessible(shipmentData, connectedCompanies) {
    if (!connectedCompanies || connectedCompanies.length === 0) return true;
    
    const shipmentCompany = shipmentData.companyID || shipmentData.companyId;
    return connectedCompanies.includes(shipmentCompany);
}

function getShipmentTotalAmount(shipmentData) {
    // Try different amount fields based on shipment type
    return shipmentData.markupRates?.totalCharges ||
           shipmentData.totalCharges ||
           shipmentData.selectedRate?.totalCharges ||
           shipmentData.manualRates?.reduce((sum, rate) => sum + (parseFloat(rate.charge) || 0), 0) ||
           0;
}

function determineMatchStatus(matches) {
    if (matches.length === 0) return 'NO_MATCH';
    
    const bestConfidence = matches[0].confidence;
    
    if (bestConfidence >= CONFIDENCE_THRESHOLDS.EXCELLENT) return 'EXCELLENT_MATCH';
    if (bestConfidence >= CONFIDENCE_THRESHOLDS.GOOD) return 'GOOD_MATCH';
    if (bestConfidence >= CONFIDENCE_THRESHOLDS.FAIR) return 'FAIR_MATCH';
    return 'POOR_MATCH';
}

function generateMatchDetails(match, invoiceShipment) {
    return {
        strategy: match.matchStrategy,
        field: match.matchField,
        value: match.matchValue,
        shipmentId: match.shipment.shipmentID || match.shipment.id,
        companyId: match.shipment.companyID || match.shipment.companyId,
        trackingNumber: match.shipment.trackingNumber,
        amount: getShipmentTotalAmount(match.shipment),
        invoiceAmount: invoiceShipment.totalAmount
    };
}

function calculateMatchingStats(matches) {
    const stats = {
        totalShipments: matches.length,
        excellentMatches: 0,
        goodMatches: 0,
        fairMatches: 0,
        poorMatches: 0,
        noMatches: 0,
        requireReview: 0,
        autoApplicable: 0
    };
    
    matches.forEach(match => {
        const confidence = match.confidence;
        
        if (confidence >= CONFIDENCE_THRESHOLDS.EXCELLENT) {
            stats.excellentMatches++;
            stats.autoApplicable++;
        } else if (confidence >= CONFIDENCE_THRESHOLDS.GOOD) {
            stats.goodMatches++;
        } else if (confidence >= CONFIDENCE_THRESHOLDS.FAIR) {
            stats.fairMatches++;
            stats.requireReview++;
        } else if (confidence >= CONFIDENCE_THRESHOLDS.POOR) {
            stats.poorMatches++;
            stats.requireReview++;
        } else {
            stats.noMatches++;
            stats.requireReview++;
        }
    });
    
    return stats;
}

export default {
    matchShipmentsToInvoice,
    CONFIDENCE_THRESHOLDS,
    MATCHING_STRATEGIES
}; 