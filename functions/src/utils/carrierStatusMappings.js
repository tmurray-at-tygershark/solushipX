// ===== CANPAR STATUS MAPPINGS =====
const CANPAR_MAPPINGS = {
    // User-confirmed Canpar status codes from real API responses only
    'PIC': 19,   // "PICKUP FROM CUSTOMER/SHIPPER" -> Picked up
    'ARR': 26,   // "ARRIVAL AT HUB/TERMINAL FROM BULK/CITY TRAILER" -> At terminal
    'SRT': 26,   // "SORT THROUGH FACILITY" -> At terminal
    'WC ': 23,   // "WITH COURIER" (note: has trailing space) -> Out for delivery
    'WC': 23,    // "WITH COURIER" (without space) -> Out for delivery
    'NSR': 30    // "DELIVERED WITH NO SIGNATURE REQUIRED" -> Delivered (backup mapping)
};

// ===== GENERIC CARRIER MAPPINGS =====
const GENERIC_MAPPINGS = {
    // Standard text-based statuses
    'DRAFT': 111,
    'PENDING': 24,
    'QUOTED': 112,
    'BOOKED': 309,
    'SCHEDULED': 16,
    'PICKUP_SCHEDULED': 12,
    'PICKED_UP': 19,
    'IN_TRANSIT': 20,
    'OUT_FOR_DELIVERY': 23,
    'DELIVERED': 30,
    'EXCEPTION': 50,
    'ON_HOLD': 290,
    'DELAYED': 300,
    'CANCELLED': 40,
    'REFUSED': 115,
    'UNDELIVERED': 113,
    'ATTEMPTED_DELIVERY': 114
};

/**
 * Map carrier status to enhanced status ID
 * @param {string} carrierStatus - The carrier's status code
 * @param {string} carrierType - The carrier type (CANPAR, etc.)
 * @returns {number} Enhanced status ID
 */
function mapCarrierStatusToEnhanced(carrierStatus, carrierType = 'GENERIC') {
    if (!carrierStatus) return 230; // Default to 'Any/Unknown'
    
    const statusCode = carrierStatus.toString().toUpperCase().trim();
    let mapping;
    
    // Select appropriate mapping based on carrier type
    switch (carrierType.toUpperCase()) {
        case 'CANPAR':
        case 'CANPAR_EXPRESS':
            mapping = CANPAR_MAPPINGS;
            break;
        default:
            mapping = GENERIC_MAPPINGS;
            break;
    }
    
    return mapping[statusCode] || 230; // Default to 'Any/Unknown' if not found
}

module.exports = {
    CANPAR_MAPPINGS,
    GENERIC_MAPPINGS,
    mapCarrierStatusToEnhanced
}; 