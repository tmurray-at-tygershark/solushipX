/**
 * Universal Shipping Data Model
 * This model provides a consistent interface for all carriers regardless of their API structure
 */

// ===== UNIVERSAL SHIPMENT STATUSES =====
export const SHIPMENT_STATUSES = {
    // Draft/Preparation Phase
    DRAFT: 'draft',
    PENDING: 'pending',
    
    // Booking Phase
    BOOKED: 'booked',
    SCHEDULED: 'scheduled',
    
    // Transit Phase
    AWAITING_SHIPMENT: 'awaiting_shipment',
    IN_TRANSIT: 'in_transit',
    
    // Completion Phase
    DELIVERED: 'delivered',
    
    // Exception Phase
    ON_HOLD: 'on_hold',
    CANCELED: 'canceled',
    CANCELLED: 'cancelled', // Legacy support
    VOID: 'void',
    
    // Error/Unknown
    UNKNOWN: 'unknown'
};

// Status Display Names
export const STATUS_DISPLAY_NAMES = {
    [SHIPMENT_STATUSES.DRAFT]: 'Draft',
    [SHIPMENT_STATUSES.PENDING]: 'Pending',
    [SHIPMENT_STATUSES.BOOKED]: 'Booked',
    [SHIPMENT_STATUSES.SCHEDULED]: 'Scheduled',
    [SHIPMENT_STATUSES.AWAITING_SHIPMENT]: 'Awaiting Shipment',
    [SHIPMENT_STATUSES.IN_TRANSIT]: 'In Transit',
    [SHIPMENT_STATUSES.DELIVERED]: 'Delivered',
    [SHIPMENT_STATUSES.ON_HOLD]: 'On Hold',
    [SHIPMENT_STATUSES.CANCELED]: 'Canceled',
    [SHIPMENT_STATUSES.CANCELLED]: 'Cancelled',
    [SHIPMENT_STATUSES.VOID]: 'Void',
    [SHIPMENT_STATUSES.UNKNOWN]: 'Unknown'
};

// Status Categories for filtering and business logic
export const STATUS_CATEGORIES = {
    ACTIVE: [
        SHIPMENT_STATUSES.PENDING,
        SHIPMENT_STATUSES.BOOKED,
        SHIPMENT_STATUSES.SCHEDULED,
        SHIPMENT_STATUSES.AWAITING_SHIPMENT,
        SHIPMENT_STATUSES.IN_TRANSIT
    ],
    COMPLETED: [
        SHIPMENT_STATUSES.DELIVERED
    ],
    EXCEPTIONS: [
        SHIPMENT_STATUSES.ON_HOLD,
        SHIPMENT_STATUSES.CANCELED,
        SHIPMENT_STATUSES.CANCELLED,
        SHIPMENT_STATUSES.VOID
    ],
    DRAFT: [
        SHIPMENT_STATUSES.DRAFT
    ]
};

// ===== STATUS MAPPING FUNCTIONS =====

/**
 * Normalize status from various carrier formats to universal format
 */
export function normalizeShipmentStatus(carrierStatus, carrierType = 'UNKNOWN') {
    if (!carrierStatus) return SHIPMENT_STATUSES.UNKNOWN;
    
    const normalizedStatus = carrierStatus.toString().toLowerCase().trim();
    
    // Common status mappings
    switch (normalizedStatus) {
        case 'draft':
        case 'created':
        case 'new':
            return SHIPMENT_STATUSES.DRAFT;
            
        case 'pending':
        case 'quoted':
        case 'rated':
            return SHIPMENT_STATUSES.PENDING;
            
        case 'booked':
        case 'confirmed':
        case 'accepted':
            return SHIPMENT_STATUSES.BOOKED;
            
        case 'scheduled':
        case 'planned':
        case 'dispatched':
            return SHIPMENT_STATUSES.SCHEDULED;
            
        case 'awaiting shipment':
        case 'awaiting_shipment':
        case 'ready':
        case 'pickup_scheduled':
            return SHIPMENT_STATUSES.AWAITING_SHIPMENT;
            
        case 'in transit':
        case 'in_transit':
        case 'intransit':
        case 'shipped':
        case 'picked_up':
        case 'pickup':
        case 'en_route':
        case 'out_for_delivery':
            return SHIPMENT_STATUSES.IN_TRANSIT;
            
        case 'delivered':
        case 'completed':
        case 'pod':
        case 'proof_of_delivery':
            return SHIPMENT_STATUSES.DELIVERED;
            
        case 'on hold':
        case 'on_hold':
        case 'onhold':
        case 'hold':
        case 'delayed':
        case 'exception':
            return SHIPMENT_STATUSES.ON_HOLD;
            
        case 'canceled':
        case 'cancelled':
        case 'cancel':
            return SHIPMENT_STATUSES.CANCELED;
            
        case 'void':
        case 'voided':
        case 'rejected':
            return SHIPMENT_STATUSES.VOID;
            
        default:
            return SHIPMENT_STATUSES.UNKNOWN;
    }
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status) {
    switch (status) {
        // Draft/Initial States - Grey
        case SHIPMENT_STATUSES.DRAFT:
            return { color: '#64748b', bgcolor: '#f1f5f9' };
        case SHIPMENT_STATUSES.UNKNOWN:
            return { color: '#6b7280', bgcolor: '#f9fafb' };
        
        // Early Processing - Amber
        case SHIPMENT_STATUSES.PENDING:
            return { color: '#d97706', bgcolor: '#fef3c7' };
        
        // Scheduled - Purple
        case SHIPMENT_STATUSES.SCHEDULED:
            return { color: '#7c3aed', bgcolor: '#ede9fe' };
        
        // Confirmed - Blue
        case SHIPMENT_STATUSES.BOOKED:
            return { color: '#2563eb', bgcolor: '#dbeafe' };
        
        // Ready to Ship - Orange
        case SHIPMENT_STATUSES.AWAITING_SHIPMENT:
            return { color: '#ea580c', bgcolor: '#fed7aa' };
        
        // In Motion - Purple
        case SHIPMENT_STATUSES.IN_TRANSIT:
            return { color: '#7c2d92', bgcolor: '#f3e8ff' };
        
        // Success - Green
        case SHIPMENT_STATUSES.DELIVERED:
            return { color: '#16a34a', bgcolor: '#dcfce7' };
        
        // Problem States - Red variants
        case SHIPMENT_STATUSES.ON_HOLD:
            return { color: '#dc2626', bgcolor: '#fee2e2' };
        case SHIPMENT_STATUSES.CANCELED:
        case SHIPMENT_STATUSES.CANCELLED:
            return { color: '#b91c1c', bgcolor: '#fecaca' };
        case SHIPMENT_STATUSES.VOID:
            return { color: '#7f1d1d', bgcolor: '#f3f4f6' };
        
        default:
            return { color: '#6b7280', bgcolor: '#f9fafb' };
    }
}

// ===== UNIVERSAL RATE STRUCTURE =====
export const UNIVERSAL_RATE_SCHEMA = {
    // Core Identifiers
    id: '',                    // Unique rate identifier (UUID or carrier-specific)
    quoteId: '',              // Carrier's quote/rate ID
    rateId: '',               // Alternative rate identifier
    
    // Carrier Information
    carrier: {
        id: '',               // Internal carrier ID (e.g., 'ESHIPPLUS', 'CANPAR')
        name: '',             // Display name (e.g., 'eShipPlus', 'Canpar Express')
        scac: '',             // Standard Carrier Alpha Code
        key: '',              // Carrier-specific key/identifier
        logo: '',             // Logo filename or URL
    },
    
    // Service Information
    service: {
        name: '',             // Service name (e.g., 'Ground', 'Express')
        code: '',             // Service code
        type: '',             // Service type classification
        mode: '',             // Transportation mode
        description: '',      // Service description
    },
    
    // Pricing (all in base currency)
    pricing: {
        currency: 'USD',      // Currency code
        total: 0,             // Total charges
        freight: 0,           // Base freight charges
        fuel: 0,              // Fuel surcharge
        accessorial: 0,       // Accessorial charges
        service: 0,           // Service charges
        insurance: 0,         // Insurance charges
        tax: 0,               // Tax charges
        discount: 0,          // Discount amount
        guarantee: 0,         // Guarantee fee
        breakdown: []         // Detailed charge breakdown
    },
    
    // Transit Information
    transit: {
        days: 0,              // Transit time in days
        hours: 0,             // Transit time in hours (for express)
        businessDays: 0,      // Business days only
        estimatedDelivery: null, // ISO date string
        guaranteed: false,    // Is delivery guaranteed
        guaranteeOptions: [], // Available guarantee options
    },
    
    // Weight and Dimensions
    weight: {
        billed: 0,            // Billed weight
        rated: 0,             // Rated weight
        actual: 0,            // Actual weight
        dimensional: 0,       // Dimensional weight
        unit: 'lbs'           // Weight unit
    },
    
    // Dimensions
    dimensions: {
        length: 0,
        width: 0,
        height: 0,
        cubicFeet: 0,
        unit: 'in'            // Dimension unit
    },
    
    // Service Features
    features: {
        residential: false,    // Residential delivery
        liftgate: false,      // Liftgate service
        insideDelivery: false, // Inside delivery
        appointmentDelivery: false, // Appointment required
        signatureRequired: false,   // Signature required
        hazmat: false,        // Hazardous materials
        freezable: false,     // Freezable protection
    },
    
    // Metadata
    metadata: {
        createdAt: null,      // When rate was created
        expiresAt: null,      // When rate expires
        source: '',           // Source system/API
        version: '1.0',       // Schema version
        confidence: 1.0,      // Rate confidence score (0-1)
        notes: [],            // Additional notes
    },
    
    // Raw carrier data (for debugging/auditing)
    raw: {
        request: null,        // Original request data
        response: null,       // Original response data
        carrier: '',          // Carrier identifier
        timestamp: null,      // When data was fetched
    }
};

// ===== UNIVERSAL BOOKING STRUCTURE =====
export const UNIVERSAL_BOOKING_SCHEMA = {
    // Core Identifiers
    id: '',                   // Booking ID
    confirmationNumber: '',   // Primary confirmation number
    referenceNumber: '',      // Customer reference
    
    // Carrier Information (inherited from rate)
    carrier: {
        id: '',
        name: '',
        scac: '',
        key: '',
    },
    
    // Booking Status
    status: {
        code: '',             // Status code (booked, in_transit, delivered, etc.)
        description: '',      // Human readable status
        updatedAt: null,      // Last status update
    },
    
    // Tracking Information
    tracking: {
        proNumber: '',        // PRO number
        bolNumber: '',        // Bill of Lading number
        trackingNumber: '',   // Primary tracking number
        alternateNumbers: [], // Alternative tracking numbers
    },
    
    // Financial Information (final booked amounts)
    pricing: {
        currency: 'USD',
        total: 0,
        freight: 0,
        fuel: 0,
        accessorial: 0,
        service: 0,
        insurance: 0,
        tax: 0,
        discount: 0,
        guarantee: 0,
        actualCharges: 0,     // Actual charges (may differ from quoted)
    },
    
    // Service Information
    service: {
        name: '',
        code: '',
        type: '',
        mode: '',
    },
    
    // Transit Information (final/actual)
    transit: {
        estimatedDelivery: null,
        actualDelivery: null,
        pickupDate: null,
        deliveryDate: null,
        guaranteed: false,
    },
    
    // Documents
    documents: {
        bol: null,            // Bill of Lading
        invoice: null,        // Invoice
        labels: [],           // Shipping labels
        pod: null,            // Proof of Delivery
        other: [],            // Other documents
    },
    
    // Metadata
    metadata: {
        bookedAt: null,
        bookedBy: '',
        source: '',
        version: '1.0',
        notes: [],
    },
    
    // Raw carrier data
    raw: {
        request: null,
        response: null,
        carrier: '',
        timestamp: null,
    }
};

// ===== UNIVERSAL SHIPMENT STRUCTURE =====
export const UNIVERSAL_SHIPMENT_SCHEMA = {
    // Core Information
    id: '',
    status: '',               // draft, rated, booked, in_transit, delivered, etc.
    type: '',                 // freight, courier, ltl, ftl, etc.
    
    // Addresses
    origin: {
        company: '',
        contact: '',
        email: '',
        phone: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        residential: false,
        specialInstructions: '',
    },
    
    destination: {
        company: '',
        contact: '',
        email: '',
        phone: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        residential: false,
        specialInstructions: '',
    },
    
    // Items/Packages
    items: [],                // Array of universal item objects
    
    // Selected Rate and Booking
    selectedRate: null,       // Universal rate object
    booking: null,            // Universal booking object
    
    // Dates
    dates: {
        created: null,
        shipDate: null,
        pickupEarliest: null,
        pickupLatest: null,
        deliveryEarliest: null,
        deliveryLatest: null,
    },
    
    // References
    references: {
        customer: '',
        po: '',
        bol: '',
        internal: '',
    },
    
    // Metadata
    metadata: {
        createdBy: '',
        companyId: '',
        source: '',
        version: '1.0',
    }
};

// ===== CARRIER MAPPING FUNCTIONS =====

/**
 * Convert eShipPlus rate data to universal format
 */
export function mapEShipPlusToUniversal(eshipData) {
    return {
        id: eshipData.quoteId || eshipData.rateId || generateId(),
        quoteId: eshipData.quoteId || eshipData.rateId,
        rateId: eshipData.rateId || eshipData.quoteId,
        
        carrier: {
            id: 'ESHIPPLUS',
            name: eshipData.carrierName || 'eShipPlus',
            scac: eshipData.carrierScac || '',
            key: eshipData.carrierKey || '',
            logo: 'eshipplus.png',
        },
        
        service: {
            name: eshipData.serviceType || eshipData.serviceMode || '',
            code: eshipData.serviceCode || '',
            type: eshipData.serviceType || '',
            mode: eshipData.serviceMode || '',
            description: eshipData.serviceDescription || '',
        },
        
        pricing: {
            currency: eshipData.currency || 'USD',
            total: parseFloat(eshipData.totalCharges || 0),
            freight: parseFloat(eshipData.freightCharges || 0),
            fuel: parseFloat(eshipData.fuelCharges || 0),
            accessorial: parseFloat(eshipData.accessorialCharges || 0),
            service: parseFloat(eshipData.serviceCharges || 0),
            insurance: parseFloat(eshipData.insuranceCharges || 0),
            tax: parseFloat(eshipData.taxCharges || 0),
            discount: parseFloat(eshipData.discountAmount || 0),
            guarantee: parseFloat(eshipData.guaranteeCharge || 0),
            breakdown: eshipData.billingDetails || [],
        },
        
        transit: {
            days: parseInt(eshipData.transitTime || eshipData.transitDays || 0),
            hours: 0,
            businessDays: parseInt(eshipData.transitTime || eshipData.transitDays || 0),
            estimatedDelivery: eshipData.estimatedDeliveryDate,
            guaranteed: eshipData.guaranteed || eshipData.guaranteedService || false,
            guaranteeOptions: eshipData.guarOptions || [],
        },
        
        weight: {
            billed: parseFloat(eshipData.billedWeight || 0),
            rated: parseFloat(eshipData.ratedWeight || 0),
            actual: parseFloat(eshipData.actualWeight || 0),
            dimensional: parseFloat(eshipData.dimensionalWeight || 0),
            unit: 'lbs',
        },
        
        dimensions: {
            length: parseFloat(eshipData.length || 0),
            width: parseFloat(eshipData.width || 0),
            height: parseFloat(eshipData.height || 0),
            cubicFeet: parseFloat(eshipData.ratedCubicFeet || 0),
            unit: 'in',
        },
        
        features: {
            residential: eshipData.residential || false,
            liftgate: eshipData.liftgate || false,
            insideDelivery: eshipData.insideDelivery || false,
            appointmentDelivery: eshipData.appointmentDelivery || false,
            signatureRequired: eshipData.signatureRequired || false,
            hazmat: eshipData.hazmat || false,
            freezable: eshipData.freezable || false,
        },
        
        metadata: {
            createdAt: new Date().toISOString(),
            expiresAt: eshipData.expiresAt,
            source: 'ESHIPPLUS_API',
            version: '1.0',
            confidence: 1.0,
            notes: eshipData.notes || [],
        },
        
        raw: {
            request: eshipData._originalRequest || null,
            response: eshipData,
            carrier: 'ESHIPPLUS',
            timestamp: new Date().toISOString(),
        }
    };
}

/**
 * Convert Canpar rate data to universal format
 */
export function mapCanparToUniversal(canparData) {
    return {
        id: canparData.quoteId || canparData.rateId || generateId(),
        quoteId: canparData.quoteId || canparData.rateId,
        rateId: canparData.rateId || canparData.quoteId,
        
        carrier: {
            id: 'CANPAR',
            name: canparData.carrierName || 'Canpar Express',
            scac: canparData.carrierScac || 'CANP',
            key: canparData.carrierKey || 'CANPAR',
            logo: 'canpar.png',
        },
        
        service: {
            name: canparData.serviceType || canparData.serviceMode || canparData.service || '',
            code: canparData.serviceCode || canparData.canparServiceType || '',
            type: canparData.serviceType || canparData.serviceMode || '',
            mode: 'COURIER',
            description: canparData.serviceDescription || '',
        },
        
        pricing: {
            currency: canparData.currency || 'CAD',
            total: parseFloat(canparData.totalCharges || canparData.totalCost || canparData.total || 0),
            freight: parseFloat(canparData.freightCharges || canparData.baseCost || canparData.freight || 0),
            fuel: parseFloat(canparData.fuelCharges || canparData.fuelSurcharge || canparData.fuel || 0),
            accessorial: parseFloat(canparData.accessorialCharges || 0),
            service: parseFloat(canparData.serviceCharges || 0),
            insurance: parseFloat(canparData.insuranceCharges || 0),
            tax: parseFloat((canparData.taxCharge1 || 0) + (canparData.taxCharge2 || 0) || canparData.taxes || canparData.tax || 0),
            discount: parseFloat(canparData.discount || 0),
            guarantee: parseFloat(canparData.guaranteeCharge || canparData.guaranteeFee || 0),
            breakdown: canparData.billingDetails || canparData.chargeBreakdown || [],
            
            // Enhanced tax handling
            taxes: {
                total: (canparData.billingDetails || [])
                    .filter(detail => detail.type === 'tax')
                    .reduce((sum, detail) => sum + detail.amount, 0),
                breakdown: (canparData.billingDetails || [])
                    .filter(detail => detail.type === 'tax')
                    .map(detail => ({
                        name: detail.name,
                        amount: detail.amount,
                        rate: null // Canpar doesn't provide tax rates
                    }))
            },
            
            // Enhanced surcharges handling
            surcharges: {
                total: canparData.accessorialCharges || 0,
                breakdown: (canparData.billingDetails || [])
                    .filter(detail => detail.type === 'accessorial')
                    .map(detail => ({
                        name: detail.name,
                        amount: detail.amount,
                        description: detail.name
                    }))
            },
            
            // Detailed billing breakdown for display
            billingDetails: canparData.billingDetails || [],
        },
        
        transit: {
            days: parseInt(canparData.transitTime || canparData.transitDays || canparData.deliveryDays || 1),
            hours: parseInt(canparData.transitHours || 0),
            businessDays: parseInt(canparData.businessDays || canparData.transitTime || canparData.transitDays || 1),
            estimatedDelivery: canparData.estimatedDeliveryDate || canparData.deliveryDate,
            guaranteed: canparData.guaranteedService || canparData.guaranteed || false,
            guaranteeOptions: canparData.guarOptions || canparData.guaranteeOptions || [],
        },
        
        weight: {
            billed: parseFloat(canparData.billedWeight || canparData.weight || 0),
            rated: parseFloat(canparData.ratedWeight || canparData.billedWeight || canparData.weight || 0),
            actual: parseFloat(canparData.actualWeight || canparData.weight || 0),
            dimensional: parseFloat(canparData.dimensionalWeight || 0),
            unit: 'lbs',
        },
        
        dimensions: {
            length: parseFloat(canparData.length || 0),
            width: parseFloat(canparData.width || 0),
            height: parseFloat(canparData.height || 0),
            cubicFeet: parseFloat(canparData.cubicFeet || 0),
            unit: 'in',
        },
        
        features: {
            residential: canparData.residential || false,
            liftgate: canparData.liftgate || false,
            insideDelivery: canparData.insideDelivery || false,
            appointmentDelivery: canparData.appointmentDelivery || false,
            signatureRequired: canparData.signatureRequired || false,
            hazmat: canparData.hazmat || false,
            freezable: canparData.freezable || false,
        },
        
        metadata: {
            createdAt: new Date().toISOString(),
            expiresAt: canparData.expiresAt,
            source: 'CANPAR_API',
            version: '1.0',
            confidence: 1.0,
            notes: canparData.notes || [],
        },
        
        raw: {
            request: canparData._originalRequest || null,
            response: canparData,
            carrier: 'CANPAR',
            timestamp: new Date().toISOString(),
        }
    };
}

/**
 * Convert universal rate to eShipPlus booking format
 */
export function mapUniversalToEShipPlusBooking(universalRate) {
    return {
        CarrierKey: universalRate.carrier.key,
        CarrierName: universalRate.carrier.name,
        CarrierScac: universalRate.carrier.scac,
        
        BilledWeight: universalRate.weight.billed,
        RatedWeight: universalRate.weight.rated,
        RatedCubicFeet: universalRate.dimensions.cubicFeet,
        
        TransitTime: universalRate.transit.days,
        EstimatedDeliveryDate: universalRate.transit.estimatedDelivery,
        
        ServiceMode: universalRate.service.mode,
        ServiceType: universalRate.service.type,
        
        FreightCharges: universalRate.pricing.freight,
        FuelCharges: universalRate.pricing.fuel,
        AccessorialCharges: universalRate.pricing.accessorial,
        ServiceCharges: universalRate.pricing.service,
        TotalCharges: universalRate.pricing.total,
        
        QuoteId: universalRate.quoteId,
        RateId: universalRate.rateId,
        
        BillingDetails: universalRate.pricing.breakdown,
        GuarOptions: universalRate.transit.guaranteeOptions,
        SelectedGuarOption: null,
        
        Mileage: 0,
        MileageSourceKey: 0,
        MileageSourceDescription: null,
    };
}

/**
 * Convert universal booking response to standard format
 */
export function mapBookingResponseToUniversal(response, carrier) {
    const baseBooking = {
        id: response.id || response.confirmationNumber || generateId(),
        confirmationNumber: response.confirmationNumber || response.proNumber || response.bolNumber,
        referenceNumber: response.referenceNumber || response.bookingReference,
        
        carrier: {
            id: carrier.toUpperCase(),
            name: response.carrierName || carrier,
            scac: response.carrierScac || '',
            key: response.carrierKey || '',
        },
        
        status: {
            code: 'booked',
            description: 'Successfully Booked',
            updatedAt: new Date().toISOString(),
        },
        
        tracking: {
            proNumber: response.proNumber || '',
            bolNumber: response.bolNumber || '',
            trackingNumber: response.trackingNumber || response.proNumber || '',
            alternateNumbers: response.alternateNumbers || [],
        },
        
        pricing: {
            currency: response.currency || 'USD',
            total: parseFloat(response.totalCharges || 0),
            freight: parseFloat(response.freightCharges || 0),
            fuel: parseFloat(response.fuelCharges || 0),
            accessorial: parseFloat(response.accessorialCharges || 0),
            service: parseFloat(response.serviceCharges || 0),
            insurance: parseFloat(response.insuranceCharges || 0),
            tax: parseFloat(response.taxCharges || 0),
            discount: parseFloat(response.discountAmount || 0),
            guarantee: parseFloat(response.guaranteeCharge || 0),
            actualCharges: parseFloat(response.actualCharges || response.totalCharges || 0),
        },
        
        service: {
            name: response.serviceName || response.service || '',
            code: response.serviceCode || '',
            type: response.serviceType || '',
            mode: response.serviceMode || '',
        },
        
        transit: {
            estimatedDelivery: response.estimatedDeliveryDate,
            actualDelivery: response.actualDeliveryDate,
            pickupDate: response.pickupDate,
            deliveryDate: response.deliveryDate,
            guaranteed: response.guaranteed || false,
        },
        
        documents: {
            bol: response.bolDocument || null,
            invoice: response.invoice || null,
            labels: response.shippingLabels || response.labels || [],
            pod: response.proofOfDelivery || null,
            other: response.otherDocuments || [],
        },
        
        metadata: {
            bookedAt: new Date().toISOString(),
            bookedBy: response.bookedBy || '',
            source: `${carrier.toUpperCase()}_API`,
            version: '1.0',
            notes: response.notes || [],
        },
        
        raw: {
            request: response._originalRequest || null,
            response: response,
            carrier: carrier.toUpperCase(),
            timestamp: new Date().toISOString(),
        }
    };
    
    return baseBooking;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Generate a unique ID
 */
function generateId() {
    return 'rate_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Validate universal rate object
 */
export function validateUniversalRate(rate) {
    const errors = [];
    
    if (!rate.id) errors.push('Missing rate ID');
    if (!rate.carrier?.id) errors.push('Missing carrier ID');
    if (!rate.carrier?.name) errors.push('Missing carrier name');
    if (!rate.pricing?.total || rate.pricing.total <= 0) errors.push('Invalid total pricing');
    if (!rate.transit?.days || rate.transit.days <= 0) errors.push('Invalid transit time');
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate universal booking object
 */
export function validateUniversalBooking(booking) {
    const errors = [];
    
    if (!booking.id) errors.push('Missing booking ID');
    if (!booking.confirmationNumber) errors.push('Missing confirmation number');
    if (!booking.carrier?.id) errors.push('Missing carrier ID');
    if (!booking.tracking?.proNumber && !booking.tracking?.trackingNumber) {
        errors.push('Missing tracking information');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Utility function to normalize rate data for display regardless of format
 * @param {Object} rate - Rate data in any format (universal, legacy, or mixed)
 * @returns {Object} - Normalized rate data for consistent display
 */
export function normalizeRateForDisplay(rate) {
    if (!rate) return null;

    // Check if it's already in universal format
    if (rate.carrier && rate.pricing && rate.transit) {
        return {
            // Core identifiers
            id: rate.id,
            rateId: rate.rateId,
            quoteId: rate.quoteId,
            
            // Carrier information (flattened for display)
            carrier: rate.carrier.name,
            carrierId: rate.carrier.id,
            carrierName: rate.carrier.name,
            carrierScac: rate.carrier.scac,
            carrierKey: rate.carrier.key,
            
            // Service information (flattened for display)
            service: rate.service.name,
            serviceName: rate.service.name,
            serviceCode: rate.service.code,
            serviceType: rate.service.type,
            serviceMode: rate.service.mode,
            
            // Pricing information (flattened for display)
            totalCharges: rate.pricing.total,
            price: rate.pricing.total, // Legacy alias
            freightCharges: rate.pricing.freight,
            freightCharge: rate.pricing.freight, // Legacy alias
            fuelCharges: rate.pricing.fuel,
            fuelCharge: rate.pricing.fuel, // Legacy alias
            serviceCharges: rate.pricing.service,
            accessorialCharges: rate.pricing.accessorial,
            insuranceCharges: rate.pricing.insurance,
            taxCharges: rate.pricing.tax,
            discountAmount: rate.pricing.discount,
            guaranteeCharge: rate.pricing.guarantee,
            currency: rate.pricing.currency,
            
            // Transit information (flattened for display)
            transitDays: rate.transit.days,
            transitTime: rate.transit.days, // Legacy alias
            transitHours: rate.transit.hours,
            businessDays: rate.transit.businessDays,
            estimatedDeliveryDate: rate.transit.estimatedDelivery,
            guaranteed: rate.transit.guaranteed,
            
            // Weight and dimensions (flattened for display)
            billedWeight: rate.weight.billed,
            ratedWeight: rate.weight.rated,
            actualWeight: rate.weight.actual,
            dimensionalWeight: rate.weight.dimensional,
            weightUnit: rate.weight.unit,
            
            length: rate.dimensions.length,
            width: rate.dimensions.width,
            height: rate.dimensions.height,
            cubicFeet: rate.dimensions.cubicFeet,
            ratedCubicFeet: rate.dimensions.cubicFeet, // Legacy alias
            dimensionUnit: rate.dimensions.unit,
            
            // Service features (flattened for display)
            residential: rate.features.residential,
            liftgate: rate.features.liftgate,
            insideDelivery: rate.features.insideDelivery,
            appointmentDelivery: rate.features.appointmentDelivery,
            signatureRequired: rate.features.signatureRequired,
            hazmat: rate.features.hazmat,
            freezable: rate.features.freezable,
            
            // Additional data
            billingDetails: rate.pricing.breakdown,
            guaranteeOptions: rate.transit.guaranteeOptions,
            
            // Metadata
            _isNormalized: true,
            _originalFormat: 'universal',
            _originalData: rate
        };
    }

    // Handle legacy or mixed formats
    return {
        // Core identifiers
        id: rate.id || rate.rateId || rate.quoteId,
        rateId: rate.rateId || rate.id,
        quoteId: rate.quoteId || rate.id,
        
        // Carrier information
        carrier: rate.carrier?.name || rate.carrierName || rate.carrier,
        carrierId: rate.carrierId || rate.carrier?.id,
        carrierName: rate.carrier?.name || rate.carrierName || rate.carrier,
        carrierScac: rate.carrierScac || rate.carrier?.scac,
        carrierKey: rate.carrierKey || rate.carrier?.key,
        
        // Service information
        service: rate.service?.name || rate.serviceName || rate.service,
        serviceName: rate.service?.name || rate.serviceName || rate.service,
        serviceCode: rate.serviceCode || rate.service?.code,
        serviceType: rate.serviceType || rate.service?.type,
        serviceMode: rate.serviceMode || rate.service?.mode,
        
        // Pricing information
        totalCharges: rate.pricing?.total || rate.totalCharges || rate.price || 0,
        price: rate.pricing?.total || rate.totalCharges || rate.price || 0,
        freightCharges: rate.pricing?.freight || rate.freightCharges || rate.freightCharge || 0,
        freightCharge: rate.pricing?.freight || rate.freightCharges || rate.freightCharge || 0,
        fuelCharges: rate.pricing?.fuel || rate.fuelCharges || rate.fuelCharge || 0,
        fuelCharge: rate.pricing?.fuel || rate.fuelCharges || rate.fuelCharge || 0,
        serviceCharges: rate.pricing?.service || rate.serviceCharges || 0,
        accessorialCharges: rate.pricing?.accessorial || rate.accessorialCharges || 0,
        insuranceCharges: rate.pricing?.insurance || rate.insuranceCharges || 0,
        taxCharges: rate.pricing?.tax || rate.taxCharges || 0,
        discountAmount: rate.pricing?.discount || rate.discountAmount || 0,
        guaranteeCharge: rate.pricing?.guarantee || rate.guaranteeCharge || 0,
        currency: rate.pricing?.currency || rate.currency || 'USD',
        
        // Transit information
        transitDays: rate.transit?.days || rate.transitDays || rate.transitTime || 0,
        transitTime: rate.transit?.days || rate.transitDays || rate.transitTime || 0,
        transitHours: rate.transit?.hours || rate.transitHours || 0,
        businessDays: rate.transit?.businessDays || rate.businessDays || rate.transitDays || 0,
        estimatedDeliveryDate: rate.transit?.estimatedDelivery || rate.estimatedDeliveryDate,
        guaranteed: rate.transit?.guaranteed || rate.guaranteed || false,
        
        // Weight and dimensions
        billedWeight: rate.weight?.billed || rate.billedWeight || 0,
        ratedWeight: rate.weight?.rated || rate.ratedWeight || 0,
        actualWeight: rate.weight?.actual || rate.actualWeight || 0,
        dimensionalWeight: rate.weight?.dimensional || rate.dimensionalWeight || 0,
        weightUnit: rate.weight?.unit || rate.weightUnit || 'lbs',
        
        length: rate.dimensions?.length || rate.length || 0,
        width: rate.dimensions?.width || rate.width || 0,
        height: rate.dimensions?.height || rate.height || 0,
        cubicFeet: rate.dimensions?.cubicFeet || rate.cubicFeet || rate.ratedCubicFeet || 0,
        ratedCubicFeet: rate.dimensions?.cubicFeet || rate.cubicFeet || rate.ratedCubicFeet || 0,
        dimensionUnit: rate.dimensions?.unit || rate.dimensionUnit || 'in',
        
        // Service features
        residential: rate.features?.residential || rate.residential || false,
        liftgate: rate.features?.liftgate || rate.liftgate || false,
        insideDelivery: rate.features?.insideDelivery || rate.insideDelivery || false,
        appointmentDelivery: rate.features?.appointmentDelivery || rate.appointmentDelivery || false,
        signatureRequired: rate.features?.signatureRequired || rate.signatureRequired || false,
        hazmat: rate.features?.hazmat || rate.hazmat || false,
        freezable: rate.features?.freezable || rate.freezable || false,
        
        // Additional data
        billingDetails: rate.pricing?.breakdown || rate.billingDetails || [],
        guaranteeOptions: rate.transit?.guaranteeOptions || rate.guaranteeOptions || [],
        
        // Metadata
        _isNormalized: true,
        _originalFormat: 'legacy',
        _originalData: rate
    };
}

/**
 * Utility function to normalize booking confirmation data for display
 * @param {Object} booking - Booking confirmation data in any format
 * @returns {Object} - Normalized booking data for consistent display
 */
export function normalizeBookingForDisplay(booking) {
    if (!booking) return null;

    // Check if it's in universal booking format
    if (booking.carrier && booking.tracking && booking.pricing) {
        return {
            // Core identifiers
            id: booking.id,
            confirmationNumber: booking.confirmationNumber,
            referenceNumber: booking.referenceNumber,
            
            // Carrier information (flattened for display)
            carrierName: booking.carrier.name,
            carrierScac: booking.carrier.scac,
            carrierKey: booking.carrier.key,
            
            // Tracking information (flattened for display)
            proNumber: booking.tracking.proNumber,
            bolNumber: booking.tracking.bolNumber,
            trackingNumber: booking.tracking.trackingNumber,
            alternateNumbers: booking.tracking.alternateNumbers,
            
            // Financial information (flattened for display)
            totalCharges: booking.pricing.total,
            freightCharges: booking.pricing.freight,
            fuelCharges: booking.pricing.fuel,
            accessorialCharges: booking.pricing.accessorial,
            serviceCharges: booking.pricing.service,
            insuranceCharges: booking.pricing.insurance,
            taxCharges: booking.pricing.tax,
            discountAmount: booking.pricing.discount,
            guaranteeCharge: booking.pricing.guarantee,
            actualCharges: booking.pricing.actualCharges,
            currency: booking.pricing.currency,
            
            // Service information (flattened for display)
            serviceName: booking.service.name,
            serviceCode: booking.service.code,
            serviceType: booking.service.type,
            serviceMode: booking.service.mode,
            
            // Transit information (flattened for display)
            estimatedDeliveryDate: booking.transit.estimatedDelivery,
            actualDeliveryDate: booking.transit.actualDelivery,
            pickupDate: booking.transit.pickupDate,
            deliveryDate: booking.transit.deliveryDate,
            guaranteed: booking.transit.guaranteed,
            
            // Documents
            documents: booking.documents,
            shippingDocuments: booking.documents?.labels || [],
            
            // Status
            status: booking.status?.code,
            statusDescription: booking.status?.description,
            
            // Metadata
            bookedAt: booking.metadata?.bookedAt,
            bookedBy: booking.metadata?.bookedBy,
            
            // Raw data
            rawBookingResponse: booking.raw?.response,
            
            _isNormalized: true,
            _originalFormat: 'universal',
            _originalData: booking
        };
    }

    // Handle legacy format
    return {
        // Core identifiers
        id: booking.id || booking.confirmationNumber,
        confirmationNumber: booking.confirmationNumber || booking.proNumber || booking.bolNumber,
        referenceNumber: booking.referenceNumber || booking.bookingReference,
        
        // Carrier information
        carrierName: booking.carrierName,
        carrierScac: booking.carrierScac,
        carrierKey: booking.carrierKey,
        
        // Tracking information
        proNumber: booking.proNumber,
        bolNumber: booking.bolNumber,
        trackingNumber: booking.trackingNumber || booking.proNumber,
        alternateNumbers: booking.alternateNumbers || [],
        
        // Financial information
        totalCharges: booking.totalCharges || 0,
        freightCharges: booking.freightCharges || 0,
        fuelCharges: booking.fuelCharges || 0,
        accessorialCharges: booking.accessorialCharges || 0,
        serviceCharges: booking.serviceCharges || 0,
        insuranceCharges: booking.insuranceCharges || 0,
        taxCharges: booking.taxCharges || 0,
        discountAmount: booking.discountAmount || 0,
        guaranteeCharge: booking.guaranteeCharge || 0,
        actualCharges: booking.actualCharges || booking.totalCharges || 0,
        currency: booking.currency || 'USD',
        
        // Service information
        serviceName: booking.serviceName || booking.service,
        serviceCode: booking.serviceCode,
        serviceType: booking.serviceType,
        serviceMode: booking.serviceMode,
        
        // Transit information
        estimatedDeliveryDate: booking.estimatedDeliveryDate,
        actualDeliveryDate: booking.actualDeliveryDate,
        pickupDate: booking.pickupDate,
        deliveryDate: booking.deliveryDate,
        guaranteed: booking.guaranteed || false,
        
        // Documents
        documents: booking.documents || {},
        shippingDocuments: booking.shippingDocuments || [],
        
        // Status
        status: booking.status,
        statusDescription: booking.statusDescription,
        
        // Metadata
        bookedAt: booking.bookedAt,
        bookedBy: booking.bookedBy,
        
        // Raw data
        rawBookingResponse: booking.rawBookingResponse,
        
        _isNormalized: true,
        _originalFormat: 'legacy',
        _originalData: booking
    };
}

/**
 * Utility function to check if data is in universal format
 * @param {Object} data - Data to check
 * @param {string} type - Type of data ('rate' or 'booking')
 * @returns {boolean} - Whether data is in universal format
 */
export function isUniversalFormat(data, type = 'rate') {
    if (!data || typeof data !== 'object') return false;
    
    if (type === 'rate') {
        return !!(data.carrier && data.pricing && data.transit && data.weight && data.dimensions);
    } else if (type === 'booking') {
        return !!(data.carrier && data.tracking && data.pricing && data.status);
    }
    
    return false;
}

/**
 * Utility function to migrate legacy rate data to universal format
 * @param {Object} legacyRate - Legacy rate data
 * @param {string} carrierType - Carrier type ('ESHIPPLUS', 'CANPAR', etc.)
 * @returns {Object} - Universal format rate
 */
export function migrateLegacyRateToUniversal(legacyRate, carrierType = 'UNKNOWN') {
    if (isUniversalFormat(legacyRate, 'rate')) {
        return legacyRate; // Already in universal format
    }
    
    // Map based on carrier type
    switch (carrierType.toUpperCase()) {
        case 'ESHIPPLUS':
            return mapEShipPlusToUniversal(legacyRate);
        case 'CANPAR':
            return mapCanparToUniversal(legacyRate);
        default:
            // Generic mapping for unknown carriers
            return {
                id: legacyRate.id || legacyRate.rateId || generateId(),
                quoteId: legacyRate.quoteId || legacyRate.id,
                rateId: legacyRate.rateId || legacyRate.id,
                
                carrier: {
                    id: carrierType,
                    name: legacyRate.carrierName || legacyRate.carrier || 'Unknown Carrier',
                    scac: legacyRate.carrierScac || '',
                    key: legacyRate.carrierKey || '',
                    logo: '',
                },
                
                service: {
                    name: legacyRate.serviceName || legacyRate.service || '',
                    code: legacyRate.serviceCode || '',
                    type: legacyRate.serviceType || '',
                    mode: legacyRate.serviceMode || '',
                    description: '',
                },
                
                pricing: {
                    currency: legacyRate.currency || 'USD',
                    total: parseFloat(legacyRate.totalCharges || legacyRate.price || 0),
                    freight: parseFloat(legacyRate.freightCharges || legacyRate.freightCharge || 0),
                    fuel: parseFloat(legacyRate.fuelCharges || legacyRate.fuelCharge || 0),
                    accessorial: parseFloat(legacyRate.accessorialCharges || 0),
                    service: parseFloat(legacyRate.serviceCharges || 0),
                    insurance: parseFloat(legacyRate.insuranceCharges || 0),
                    tax: parseFloat(legacyRate.taxCharges || 0),
                    discount: parseFloat(legacyRate.discountAmount || 0),
                    guarantee: parseFloat(legacyRate.guaranteeCharge || 0),
                    breakdown: legacyRate.billingDetails || [],
                },
                
                transit: {
                    days: parseInt(legacyRate.transitDays || legacyRate.transitTime || 0),
                    hours: 0,
                    businessDays: parseInt(legacyRate.businessDays || legacyRate.transitDays || 0),
                    estimatedDelivery: legacyRate.estimatedDeliveryDate,
                    guaranteed: legacyRate.guaranteed || false,
                    guaranteeOptions: legacyRate.guaranteeOptions || [],
                },
                
                weight: {
                    billed: parseFloat(legacyRate.billedWeight || 0),
                    rated: parseFloat(legacyRate.ratedWeight || 0),
                    actual: parseFloat(legacyRate.actualWeight || 0),
                    dimensional: parseFloat(legacyRate.dimensionalWeight || 0),
                    unit: 'lbs',
                },
                
                dimensions: {
                    length: parseFloat(legacyRate.length || 0),
                    width: parseFloat(legacyRate.width || 0),
                    height: parseFloat(legacyRate.height || 0),
                    cubicFeet: parseFloat(legacyRate.cubicFeet || legacyRate.ratedCubicFeet || 0),
                    unit: 'in',
                },
                
                features: {
                    residential: legacyRate.residential || false,
                    liftgate: legacyRate.liftgate || false,
                    insideDelivery: legacyRate.insideDelivery || false,
                    appointmentDelivery: legacyRate.appointmentDelivery || false,
                    signatureRequired: legacyRate.signatureRequired || false,
                    hazmat: legacyRate.hazmat || false,
                    freezable: legacyRate.freezable || false,
                },
                
                metadata: {
                    createdAt: new Date().toISOString(),
                    expiresAt: legacyRate.expiresAt,
                    source: `${carrierType}_LEGACY_MIGRATION`,
                    version: '1.0',
                    confidence: 0.8, // Lower confidence for migrated data
                    notes: ['Migrated from legacy format'],
                },
                
                raw: {
                    request: null,
                    response: legacyRate,
                    carrier: carrierType,
                    timestamp: new Date().toISOString(),
                }
            };
    }
}

export default {
    UNIVERSAL_RATE_SCHEMA,
    UNIVERSAL_BOOKING_SCHEMA,
    UNIVERSAL_SHIPMENT_SCHEMA,
    mapEShipPlusToUniversal,
    mapCanparToUniversal,
    mapUniversalToEShipPlusBooking,
    mapBookingResponseToUniversal,
    validateUniversalRate,
    validateUniversalBooking,
    normalizeRateForDisplay,
    normalizeBookingForDisplay,
    isUniversalFormat,
    migrateLegacyRateToUniversal,
}; 