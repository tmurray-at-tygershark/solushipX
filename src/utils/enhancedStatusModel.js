/**
 * Enhanced Shipment Status System
 * Provides granular status tracking with 60+ specific statuses
 * Maintains backward compatibility with existing simple status system
 */

// ===== ENHANCED SHIPMENT STATUSES =====
export const ENHANCED_STATUSES = {
  // System/Special Statuses
  230: { id: 230, name: 'Any', category: 'SYSTEM', group: 'SYSTEM', color: '#64748b', description: 'System filter option' },
  308: { id: 308, name: 'Comments', category: 'SYSTEM', group: 'SYSTEM', color: '#64748b', description: 'Comments or notes added' },
  220: { id: 220, name: 'Wish list', category: 'SYSTEM', group: 'SYSTEM', color: '#64748b', description: 'Saved for later' },

  // Pre-Shipment Phase (Preparation)
  111: { id: 111, name: 'Request Quote', category: 'PREPARATION', group: 'PRE_SHIPMENT', color: '#d97706', description: 'Quote requested' },
  112: { id: 112, name: 'Quoted', category: 'PREPARATION', group: 'PRE_SHIPMENT', color: '#d97706', description: 'Quote provided' },
  80: { id: 80, name: 'Ready to process', category: 'PREPARATION', group: 'PRE_SHIPMENT', color: '#ea580c', description: 'Ready for processing' },
  10: { id: 10, name: 'Ready for shipping', category: 'PREPARATION', group: 'PRE_SHIPMENT', color: '#ea580c', description: 'Ready to ship' },
  100: { id: 100, name: 'Sent to warehouse', category: 'PREPARATION', group: 'PRE_SHIPMENT', color: '#ea580c', description: 'Sent to warehouse' },
  110: { id: 110, name: 'Received by warehouse', category: 'PREPARATION', group: 'PRE_SHIPMENT', color: '#ea580c', description: 'Received by warehouse' },

  // Booking & Scheduling Phase
  319: { id: 319, name: 'Booking requested', category: 'BOOKING', group: 'BOOKING', color: '#7c3aed', description: 'Booking request submitted' },
  309: { id: 309, name: 'Booking confirmed', category: 'BOOKING', group: 'BOOKING', color: '#2563eb', description: 'Booking confirmed' },
  122: { id: 122, name: 'Appointment', category: 'SCHEDULING', group: 'BOOKING', color: '#7c3aed', description: 'Appointment scheduled' },
  260: { id: 260, name: 'Appointment confirmed', category: 'SCHEDULING', group: 'BOOKING', color: '#2563eb', description: 'Appointment confirmed' },
  22: { id: 22, name: 'Booking appointment', category: 'SCHEDULING', group: 'BOOKING', color: '#7c3aed', description: 'Booking appointment' },
  250: { id: 250, name: 'Awaiting appointment', category: 'SCHEDULING', group: 'BOOKING', color: '#d97706', description: 'Waiting for appointment' },
  16: { id: 16, name: 'Scheduled for pick up', category: 'SCHEDULING', group: 'BOOKING', color: '#7c3aed', description: 'Pickup scheduled' },

  // Pre-Transit Phase
  60: { id: 60, name: 'Predispatched', category: 'PRE_TRANSIT', group: 'PREPARATION', color: '#ea580c', description: 'Predispatched' },
  11: { id: 11, name: 'To be dispatched', category: 'PRE_TRANSIT', group: 'PREPARATION', color: '#ea580c', description: 'To be dispatched' },
  15: { id: 15, name: 'Scheduled to depart', category: 'PRE_TRANSIT', group: 'PREPARATION', color: '#7c3aed', description: 'Scheduled to depart' },
  24: { id: 24, name: 'Pending', category: 'PRE_TRANSIT', group: 'PREPARATION', color: '#d97706', description: 'Pending processing' },

  // Pickup & Collection Phase
  12: { id: 12, name: 'Out for pickup', category: 'PICKUP', group: 'TRANSIT', color: '#7c2d92', description: 'Out for pickup' },
  19: { id: 19, name: 'Picked up', category: 'PICKUP', group: 'TRANSIT', color: '#7c2d92', description: 'Successfully picked up' },
  307: { id: 307, name: 'Scan to picked up', category: 'PICKUP', group: 'TRANSIT', color: '#7c2d92', description: 'Scanned as picked up' },
  121: { id: 121, name: 'Shipment dropped off', category: 'PICKUP', group: 'TRANSIT', color: '#7c2d92', description: 'Dropped off at terminal' },

  // Transit & Movement Phase
  20: { id: 20, name: 'In transit', category: 'TRANSIT', group: 'TRANSIT', color: '#7c2d92', description: 'In transit' },
  21: { id: 21, name: 'On route', category: 'TRANSIT', group: 'TRANSIT', color: '#7c2d92', description: 'On route to destination' },
  14: { id: 14, name: 'On board', category: 'TRANSIT', group: 'TRANSIT', color: '#7c2d92', description: 'On board vehicle' },
  26: { id: 26, name: 'At terminal', category: 'TRANSIT', group: 'TRANSIT', color: '#7c2d92', description: 'At terminal facility' },
  25: { id: 25, name: 'In customs', category: 'TRANSIT', group: 'TRANSIT', color: '#7c2d92', description: 'In customs clearance' },
  13: { id: 13, name: 'Trailer dropped', category: 'TRANSIT', group: 'TRANSIT', color: '#7c2d92', description: 'Trailer dropped at destination' },

  // Rail & Vessel Transit
  312: { id: 312, name: 'Loaded onboard vessel', category: 'VESSEL', group: 'TRANSIT', color: '#7c2d92', description: 'Loaded on vessel' },
  313: { id: 313, name: 'Vessel departure', category: 'VESSEL', group: 'TRANSIT', color: '#7c2d92', description: 'Vessel departed' },
  314: { id: 314, name: 'Vessel arrival', category: 'VESSEL', group: 'TRANSIT', color: '#7c2d92', description: 'Vessel arrived' },
  320: { id: 320, name: 'Discharged from vessel', category: 'VESSEL', group: 'TRANSIT', color: '#7c2d92', description: 'Discharged from vessel' },
  315: { id: 315, name: 'Transfer to rail', category: 'RAIL', group: 'TRANSIT', color: '#7c2d92', description: 'Transferred to rail' },
  316: { id: 316, name: 'Rail departure', category: 'RAIL', group: 'TRANSIT', color: '#7c2d92', description: 'Rail departed' },
  317: { id: 317, name: 'Rail arrival', category: 'RAIL', group: 'TRANSIT', color: '#7c2d92', description: 'Rail arrived' },

  // Container Operations
  310: { id: 310, name: 'Origin gate out - empty', category: 'CONTAINER', group: 'TRANSIT', color: '#7c2d92', description: 'Empty container gate out' },
  311: { id: 311, name: 'Origin gate in - full', category: 'CONTAINER', group: 'TRANSIT', color: '#7c2d92', description: 'Full container gate in' },
  318: { id: 318, name: 'Destination gate out', category: 'CONTAINER', group: 'TRANSIT', color: '#7c2d92', description: 'Container gate out at destination' },
  321: { id: 321, name: 'Empty returned to carrier', category: 'CONTAINER', group: 'TRANSIT', color: '#7c2d92', description: 'Empty container returned' },

  // Delivery Process Phase
  23: { id: 23, name: 'Out for delivery', category: 'DELIVERY', group: 'DELIVERY', color: '#7c2d92', description: 'Out for delivery' },
  81: { id: 81, name: 'Estimated delivery', category: 'DELIVERY', group: 'DELIVERY', color: '#7c2d92', description: 'Estimated delivery time' },
  280: { id: 280, name: 'Held for pick up', category: 'DELIVERY', group: 'DELIVERY', color: '#d97706', description: 'Held for customer pickup' },
  270: { id: 270, name: 'Hold for appointment', category: 'DELIVERY', group: 'DELIVERY', color: '#d97706', description: 'Held for delivery appointment' },

  // Completed Phase
  30: { id: 30, name: 'Delivered', category: 'COMPLETED', group: 'COMPLETED', color: '#16a34a', description: 'Successfully delivered' },
  82: { id: 82, name: 'Picture', category: 'COMPLETED', group: 'COMPLETED', color: '#16a34a', description: 'Delivery photo taken' },
  70: { id: 70, name: 'Closed', category: 'COMPLETED', group: 'COMPLETED', color: '#16a34a', description: 'Shipment closed' },

  // Exception & Problem Phase
  50: { id: 50, name: 'Exception', category: 'EXCEPTION', group: 'EXCEPTIONS', color: '#dc2626', description: 'General exception' },
  114: { id: 114, name: 'Attempted delivery', category: 'EXCEPTION', group: 'EXCEPTIONS', color: '#dc2626', description: 'Delivery attempted' },
  322: { id: 322, name: 'Not delivered', category: 'EXCEPTION', group: 'EXCEPTIONS', color: '#dc2626', description: 'Not delivered' },
  115: { id: 115, name: 'Refused', category: 'EXCEPTION', group: 'EXCEPTIONS', color: '#dc2626', description: 'Delivery refused' },
  113: { id: 113, name: 'Undelivered', category: 'EXCEPTION', group: 'EXCEPTIONS', color: '#dc2626', description: 'Undelivered' },
  116: { id: 116, name: 'Appointment missed', category: 'EXCEPTION', group: 'EXCEPTIONS', color: '#dc2626', description: 'Delivery appointment missed' },

  // Delay & Hold Phase
  300: { id: 300, name: 'Delay', category: 'DELAY', group: 'EXCEPTIONS', color: '#dc2626', description: 'Shipment delayed' },
  302: { id: 302, name: 'Possible delay', category: 'DELAY', group: 'EXCEPTIONS', color: '#d97706', description: 'Possible delay' },
  120: { id: 120, name: 'Weather delay', category: 'DELAY', group: 'EXCEPTIONS', color: '#dc2626', description: 'Weather-related delay' },
  119: { id: 119, name: 'Hazardous material delay', category: 'DELAY', group: 'EXCEPTIONS', color: '#dc2626', description: 'Hazmat delay' },
  118: { id: 118, name: 'Shipment tendered late', category: 'DELAY', group: 'EXCEPTIONS', color: '#dc2626', description: 'Late tender' },
  117: { id: 117, name: 'Beyond our control', category: 'DELAY', group: 'EXCEPTIONS', color: '#dc2626', description: 'Beyond carrier control' },
  290: { id: 290, name: 'On hold', category: 'HOLD', group: 'EXCEPTIONS', color: '#dc2626', description: 'Shipment on hold' },

  // Cancelled & Void Phase
  40: { id: 40, name: 'Cancelled', category: 'CANCELLED', group: 'CANCELLED', color: '#b91c1c', description: 'Shipment cancelled' },

  // Additional missing statuses from user's list
  118: { id: 118, name: 'Shipment tendered late', category: 'DELAY', group: 'EXCEPTIONS', color: '#dc2626', description: 'Late tender' },
  120: { id: 120, name: 'Weather delay', category: 'DELAY', group: 'EXCEPTIONS', color: '#dc2626', description: 'Weather-related delay' },
  302: { id: 302, name: 'Possible delay', category: 'DELAY', group: 'EXCEPTIONS', color: '#d97706', description: 'Possible delay' },
  303: { id: 303, name: 'Return to sender', category: 'RETURN', group: 'EXCEPTIONS', color: '#dc2626', description: 'Return to sender' },

  // Special Operations
  301: { id: 301, name: 'Re-routed', category: 'ROUTING', group: 'TRANSIT', color: '#7c2d92', description: 'Shipment re-routed' },
  304: { id: 304, name: 'Storage', category: 'STORAGE', group: 'TRANSIT', color: '#d97706', description: 'In storage' },

  // Claims & Issues
  305: { id: 305, name: 'Claim in process', category: 'CLAIMS', group: 'EXCEPTIONS', color: '#dc2626', description: 'Insurance claim in process' },
  306: { id: 306, name: 'Claim closed', category: 'CLAIMS', group: 'EXCEPTIONS', color: '#16a34a', description: 'Insurance claim closed' }
};

// ===== STATUS GROUPS =====
export const STATUS_GROUPS = {
  PRE_SHIPMENT: {
    name: 'Pre-Shipment',
    description: 'Quote requests and preparation',
    statuses: [111, 112, 80, 10, 100, 110, 60, 11, 15, 24],
    color: '#ea580c'
  },
  BOOKING: {
    name: 'Booking & Scheduling',
    description: 'Booking confirmation and scheduling',
    statuses: [319, 309, 122, 260, 22, 250, 16],
    color: '#7c3aed'
  },
  TRANSIT: {
    name: 'In Transit',
    description: 'Pickup through delivery process',
    statuses: [12, 19, 307, 121, 20, 21, 14, 26, 25, 13, 312, 313, 314, 320, 315, 316, 317, 310, 311, 318, 321, 301, 304],
    color: '#7c2d92'
  },
  DELIVERY: {
    name: 'Delivery Process',
    description: 'Out for delivery and delivery attempts',
    statuses: [23, 81, 280, 270],
    color: '#7c2d92'
  },
  COMPLETED: {
    name: 'Completed',
    description: 'Successfully delivered and closed',
    statuses: [30, 82, 70, 306],
    color: '#16a34a'
  },
  EXCEPTIONS: {
    name: 'Exceptions & Issues',
    description: 'Problems, delays, and delivery issues',
    statuses: [50, 114, 322, 115, 113, 116, 300, 302, 120, 119, 118, 117, 290, 305],
    color: '#dc2626'
  },
  CANCELLED: {
    name: 'Cancelled',
    description: 'Cancelled or voided shipments',
    statuses: [40],
    color: '#b91c1c'
  },
  SYSTEM: {
    name: 'System',
    description: 'System statuses and special cases',
    statuses: [230, 308, 220],
    color: '#64748b'
  }
};

// ===== BACKWARD COMPATIBILITY MAPPING =====
export const LEGACY_STATUS_MAP = {
  // Map old simple statuses to new granular ones (primary mapping)
  'draft': 111,           // Request Quote (most common draft state)
  'pending': 24,          // Pending
  'booked': 309,          // Booking confirmed
  'scheduled': 16,        // Scheduled for pick up
  'awaiting_shipment': 11, // To be dispatched
  'in_transit': 20,       // In transit
  'delivered': 30,        // Delivered
  'on_hold': 290,         // On hold
  'cancelled': 40,        // Cancelled
  'canceled': 40,         // Cancelled (alternate spelling)
  'void': 40,             // Void maps to cancelled
  'unknown': 230          // Any/Unknown
};

export const GRANULAR_TO_LEGACY_MAP = {
  // Map granular statuses back to legacy for compatibility
  111: 'draft',           // Request Quote -> draft
  112: 'draft',           // Quoted -> draft
  80: 'pending',          // Ready to process -> pending
  10: 'pending',          // Ready for shipping -> pending
  100: 'pending',         // Sent to warehouse -> pending
  110: 'pending',         // Received by warehouse -> pending
  319: 'booked',          // Booking requested -> booked
  309: 'booked',          // Booking confirmed -> booked
  122: 'scheduled',       // Appointment -> scheduled
  260: 'scheduled',       // Appointment confirmed -> scheduled
  22: 'scheduled',        // Booking appointment -> scheduled
  250: 'scheduled',       // Awaiting appointment -> scheduled
  16: 'scheduled',        // Scheduled for pick up -> scheduled
  60: 'awaiting_shipment', // Predispatched -> awaiting_shipment
  11: 'awaiting_shipment', // To be dispatched -> awaiting_shipment
  15: 'awaiting_shipment', // Scheduled to depart -> awaiting_shipment
  24: 'pending',          // Pending -> pending
  12: 'in_transit',       // Out for pickup -> in_transit
  19: 'in_transit',       // Picked up -> in_transit
  307: 'in_transit',      // Scan to picked up -> in_transit
  121: 'in_transit',      // Shipment dropped off -> in_transit
  20: 'in_transit',       // In transit -> in_transit
  21: 'in_transit',       // On route -> in_transit
  14: 'in_transit',       // On board -> in_transit
  26: 'in_transit',       // At terminal -> in_transit
  25: 'in_transit',       // In customs -> in_transit
  13: 'in_transit',       // Trailer dropped -> in_transit
  312: 'in_transit',      // Loaded onboard vessel -> in_transit
  313: 'in_transit',      // Vessel departure -> in_transit
  314: 'in_transit',      // Vessel arrival -> in_transit
  320: 'in_transit',      // Discharged from vessel -> in_transit
  315: 'in_transit',      // Transfer to rail -> in_transit
  316: 'in_transit',      // Rail departure -> in_transit
  317: 'in_transit',      // Rail arrival -> in_transit
  310: 'in_transit',      // Origin gate out - empty -> in_transit
  311: 'in_transit',      // Origin gate in - full -> in_transit
  318: 'in_transit',      // Destination gate out -> in_transit
  321: 'in_transit',      // Empty returned to carrier -> in_transit
  23: 'in_transit',       // Out for delivery -> in_transit
  81: 'in_transit',       // Estimated delivery -> in_transit
  280: 'on_hold',         // Held for pick up -> on_hold
  270: 'on_hold',         // Hold for appointment -> on_hold
  30: 'delivered',        // Delivered -> delivered
  82: 'delivered',        // Picture -> delivered
  70: 'delivered',        // Closed -> delivered
  50: 'on_hold',          // Exception -> on_hold
  114: 'on_hold',         // Attempted delivery -> on_hold
  322: 'on_hold',         // Not delivered -> on_hold
  115: 'on_hold',         // Refused -> on_hold
  113: 'on_hold',         // Undelivered -> on_hold
  116: 'on_hold',         // Appointment missed -> on_hold
  300: 'on_hold',         // Delay -> on_hold
  302: 'on_hold',         // Possible delay -> on_hold
  120: 'on_hold',         // Weather delay -> on_hold
  119: 'on_hold',         // Hazardous material delay -> on_hold
  118: 'on_hold',         // Shipment tendered late -> on_hold
  117: 'on_hold',         // Beyond our control -> on_hold
  290: 'on_hold',         // On hold -> on_hold
  40: 'cancelled',        // Cancelled -> cancelled
  301: 'in_transit',      // Re-routed -> in_transit
  304: 'on_hold',         // Storage -> on_hold
  305: 'on_hold',         // Claim in process -> on_hold
  306: 'delivered',       // Claim closed -> delivered
  230: 'unknown',         // Any -> unknown
  308: 'unknown',         // Comments -> unknown
  220: 'draft'            // Wish list -> draft
};

// ===== STATUS CATEGORIES =====
export const STATUS_CATEGORIES = {
  ACTIVE: [111, 112, 80, 10, 100, 110, 319, 309, 122, 260, 22, 250, 16, 60, 11, 15, 24, 12, 19, 307, 121, 20, 21, 14, 26, 25, 13, 23, 81],
  COMPLETED: [30, 82, 70, 306],
  EXCEPTIONS: [50, 114, 322, 115, 113, 116, 300, 302, 120, 119, 118, 117, 290, 280, 270, 305],
  CANCELLED: [40],
  SYSTEM: [230, 308, 220]
};

// ===== UTILITY FUNCTIONS =====

/**
 * Get enhanced status by ID
 */
export function getEnhancedStatus(statusId) {
  return ENHANCED_STATUSES[statusId] || null;
}

/**
 * Get status color (enhanced version)
 */
export function getEnhancedStatusColor(statusId) {
  const status = ENHANCED_STATUSES[statusId];
  if (!status) {
    return { color: '#6b7280', bgcolor: '#f9fafb' };
  }
  
  return {
    color: status.color,
    bgcolor: `${status.color}20` // 20% opacity
  };
}

/**
 * Convert legacy status to enhanced status ID
 */
export function legacyToEnhanced(legacyStatus) {
  return LEGACY_STATUS_MAP[legacyStatus?.toLowerCase()] || 230; // Default to 'Any'
}

/**
 * Convert enhanced status ID to legacy status
 */
export function enhancedToLegacy(statusId) {
  return GRANULAR_TO_LEGACY_MAP[statusId] || 'unknown';
}

/**
 * Get all statuses in a group
 */
export function getStatusesInGroup(groupName) {
  const group = STATUS_GROUPS[groupName];
  return group ? group.statuses.map(id => ENHANCED_STATUSES[id]).filter(Boolean) : [];
}

/**
 * Check if status is in category
 */
export function isStatusInCategory(statusId, category) {
  return STATUS_CATEGORIES[category]?.includes(statusId) || false;
}

/**
 * Get group for status
 */
export function getStatusGroup(statusId) {
  for (const [groupName, group] of Object.entries(STATUS_GROUPS)) {
    if (group.statuses.includes(statusId)) {
      return groupName;
    }
  }
  return 'SYSTEM';
}

/**
 * Normalize carrier status to enhanced status ID
 */
export function normalizeCarrierStatusToEnhanced(carrierStatus, carrierType = 'UNKNOWN') {
  if (!carrierStatus) return 230; // Any/Unknown
  
  const normalizedStatus = carrierStatus.toString().toLowerCase().trim();
  
  // Direct status name mapping first
  for (const [id, status] of Object.entries(ENHANCED_STATUSES)) {
    if (status.name.toLowerCase() === normalizedStatus) {
      return parseInt(id);
    }
  }
  
  // Carrier-specific mappings
  if (carrierType === 'ESHIPPLUS') {
    return normalizeEShipPlusStatus(carrierStatus);
  } else if (carrierType === 'CANPAR') {
    return normalizeCanparStatus(carrierStatus);
  } else if (carrierType === 'POLARIS') {
    return normalizePolarisStatus(carrierStatus);
  }
  
  // Fallback to legacy normalization
  const legacyStatus = normalizeShipmentStatusLegacy(carrierStatus);
  return legacyToEnhanced(legacyStatus);
}

/**
 * Legacy status normalization (backward compatibility)
 */
function normalizeShipmentStatusLegacy(carrierStatus) {
  if (!carrierStatus) return 'unknown';
  
  const normalizedStatus = carrierStatus.toString().toLowerCase().trim();
  
  // Common status mappings
  switch (normalizedStatus) {
    case 'draft':
    case 'created':
    case 'new':
      return 'draft';
    case 'pending':
    case 'quoted':
    case 'rated':
      return 'pending';
    case 'booked':
    case 'confirmed':
    case 'accepted':
      return 'booked';
    case 'scheduled':
    case 'planned':
    case 'dispatched':
      return 'scheduled';
    case 'awaiting shipment':
    case 'awaiting_shipment':
    case 'ready':
    case 'pickup_scheduled':
      return 'awaiting_shipment';
    case 'in transit':
    case 'in_transit':
    case 'intransit':
    case 'shipped':
    case 'picked_up':
    case 'pickup':
    case 'en_route':
    case 'out_for_delivery':
      return 'in_transit';
    case 'delivered':
    case 'completed':
    case 'pod':
    case 'proof_of_delivery':
      return 'delivered';
    case 'on hold':
    case 'on_hold':
    case 'onhold':
    case 'hold':
    case 'delayed':
    case 'exception':
      return 'on_hold';
    case 'canceled':
    case 'cancelled':
    case 'cancel':
      return 'cancelled';
    case 'void':
    case 'voided':
    case 'rejected':
      return 'void';
    default:
      return 'unknown';
  }
}

/**
 * eShipPlus specific status normalization
 * Maps eShipPlus check call codes to enhanced status IDs
 */
function normalizeEShipPlusStatus(eshipStatus) {
  const statusMap = {
    // Pre-shipment and Booking Phase
    'AA': 112,  // Shipment created -> Quoted
    'A1': 319,  // Booking request submitted -> Booking requested
    'A2': 309,  // Booking confirmed -> Booking confirmed
    'A3': 250,  // Awaiting pickup appointment -> Awaiting appointment
    'A4': 122,  // Pickup appointment scheduled -> Appointment
    'A5': 260,  // Pickup appointment confirmed -> Appointment confirmed
    
    // Pickup Phase
    'B1': 12,   // Dispatched for pickup -> Out for pickup
    'B2': 19,   // Picked up -> Picked up
    'B3': 121,  // Delivered to terminal -> Shipment dropped off
    'B4': 307,  // Pickup scan completed -> Scan to picked up
    
    // Transit Phase
    'C1': 20,   // In transit -> In transit
    'C2': 21,   // En route to destination -> On route
    'C3': 26,   // At intermediate terminal -> At terminal
    'C4': 25,   // In customs -> In customs
    'C5': 301,  // Rerouted -> Re-routed
    'C6': 14,   // On delivery vehicle -> On board
    
    // Rail/Vessel Transit (for intermodal shipments)
    'R1': 315,  // Transferred to rail -> Transfer to rail
    'R2': 316,  // Rail departed -> Rail departure
    'R3': 317,  // Rail arrived -> Rail arrival
    'V1': 312,  // Loaded on vessel -> Loaded onboard vessel
    'V2': 313,  // Vessel departed -> Vessel departure
    'V3': 314,  // Vessel arrived -> Vessel arrival
    'V4': 320,  // Discharged from vessel -> Discharged from vessel
    
    // Container Operations
    'K1': 310,  // Empty container gate out -> Origin gate out - empty
    'K2': 311,  // Full container gate in -> Origin gate in - full
    'K3': 318,  // Container gate out at destination -> Destination gate out
    'K4': 321,  // Empty container returned -> Empty returned to carrier
    
    // Delivery Phase
    'D1': 23,   // Out for delivery -> Out for delivery
    'D2': 114,  // Attempted delivery -> Attempted delivery
    'D3': 280,  // Held for customer pickup -> Held for pick up
    'D4': 270,  // Hold for delivery appointment -> Hold for appointment
    'D5': 81,   // Estimated delivery today -> Estimated delivery
    
    // Completed Phase
    'E1': 30,   // Delivered -> Delivered
    'E2': 82,   // Delivery photo taken -> Picture
    'E3': 70,   // Shipment closed -> Closed
    
    // Exception and Problem Phase
    'X1': 50,   // General exception -> Exception
    'X2': 115,  // Delivery refused -> Refused
    'X3': 113,  // Undelivered -> Undelivered
    'X4': 116,  // Appointment missed -> Appointment missed
    'X5': 322,  // Could not deliver -> Not delivered
    
    // Delay Phase
    'Y1': 300,  // Shipment delayed -> Delay
    'Y2': 302,  // Possible delay -> Possible delay
    'Y3': 120,  // Weather delay -> Weather delay
    'Y4': 119,  // Hazmat delay -> Hazardous material delay
    'Y5': 118,  // Late tender -> Shipment tendered late
    'Y6': 117,  // Beyond carrier control -> Beyond our control
    'Y7': 290,  // On hold -> On hold
    
    // Storage and Special Operations
    'S1': 304,  // In storage -> Storage
    'S2': 301,  // Rerouted -> Re-routed
    
    // Claims and Issues
    'Z1': 305,  // Claim filed -> Claim in process
    'Z2': 306,  // Claim resolved -> Claim closed
    
    // Cancellation
    'W1': 40,   // Shipment cancelled -> Cancelled
    
    // Legacy codes for backward compatibility
    'BB': 20,   // In transit (legacy) -> In transit
    'CC': 30,   // Delivered (legacy) -> Delivered
    'DD': 40,   // Cancelled (legacy) -> Cancelled
    'EE': 50,   // Exception (legacy) -> Exception
    'FF': 290,  // On hold (legacy) -> On hold
  };
  
  return statusMap[eshipStatus] || 230; // Default to Any/Unknown
}

/**
 * Canpar specific status normalization
 * Maps Canpar tracking status codes to enhanced status IDs
 */
function normalizeCanparStatus(canparStatus) {
  const statusMap = {
    // Pre-shipment Phase
    'CR': 112,  // Created -> Quoted
    'MF': 111,  // Manifest -> Request Quote
    'RT': 309,  // Ready -> Booking confirmed
    
    // Pickup Phase
    'PU': 19,   // Picked Up -> Picked up
    'IP': 19,   // Item Picked up -> Picked up
    'DP': 121,  // Depot -> Shipment dropped off
    'SC': 307,  // Scan Complete -> Scan to picked up
    
    // Transit Phase
    'IT': 20,   // In Transit -> In transit
    'TR': 21,   // Transfer -> On route
    'HB': 26,   // Hub -> At terminal
    'LD': 14,   // Loaded -> On board
    'OT': 21,   // On Truck -> On route
    'AR': 26,   // Arrived -> At terminal
    
    // Delivery Phase
    'OD': 23,   // Out for Delivery -> Out for delivery
    'AD': 114,  // Attempted Delivery -> Attempted delivery
    'DL': 30,   // Delivered -> Delivered
    'POD': 30,  // Proof of Delivery -> Delivered
    'SIG': 82,  // Signature -> Picture
    
    // Exception Phase
    'EX': 50,   // Exception -> Exception
    'RF': 115,  // Refused -> Refused
    'UA': 113,  // Undeliverable -> Undelivered
    'MM': 116,  // Missed -> Appointment missed
    'HL': 290,  // Hold -> On hold
    'DL': 300,  // Delay -> Delay
    'WD': 120,  // Weather Delay -> Weather delay
    
    // Special Handling
    'HP': 280,  // Hold for Pickup -> Held for pick up
    'RTS': 303, // Return to Sender -> Return to sender
    'RR': 301,  // Reroute -> Re-routed
    'ST': 304,  // Storage -> Storage
    
    // Cancellation
    'CN': 40,   // Cancelled -> Cancelled
    'VD': 40,   // Void -> Cancelled
    
    // Claims
    'CL': 305,  // Claim -> Claim in process
    'CR': 306,  // Claim Resolved -> Claim closed
    
    // Legacy/Alternative codes
    'DELIVERED': 30,     // Delivered (text) -> Delivered
    'IN_TRANSIT': 20,    // In Transit (text) -> In transit
    'EXCEPTION': 50,     // Exception (text) -> Exception
    'CANCELLED': 40      // Cancelled (text) -> Cancelled
  };
  
  return statusMap[canparStatus?.toUpperCase()] || 230; // Default to Any/Unknown
}

/**
 * Polaris Transportation specific status normalization
 * Maps Polaris PRO number status codes to enhanced status IDs
 */
function normalizePolarisStatus(polarisStatus) {
  const statusMap = {
    // Pre-shipment Phase
    'REQ': 111,  // Request -> Request Quote
    'QTD': 112,  // Quoted -> Quoted
    'BOK': 309,  // Booked -> Booking confirmed
    'SCD': 16,   // Scheduled -> Scheduled for pick up
    
    // Pickup Phase
    'DSP': 12,   // Dispatched -> Out for pickup
    'PKD': 19,   // Picked up -> Picked up
    'RCV': 121,  // Received -> Shipment dropped off
    'TRM': 26,   // Terminal -> At terminal
    
    // Transit Phase
    'TRN': 20,   // Transit -> In transit
    'ENR': 21,   // En Route -> On route
    'HUB': 26,   // Hub -> At terminal
    'XFR': 21,   // Transfer -> On route
    'LOD': 14,   // Loaded -> On board
    'DEP': 21,   // Departed -> On route
    
    // Line Haul (Long Distance Transport)
    'LHL': 20,   // Line Haul -> In transit
    'ARV': 26,   // Arrived -> At terminal
    'ULD': 26,   // Unloaded -> At terminal
    
    // Final Mile Delivery
    'OFD': 23,   // Out for Delivery -> Out for delivery
    'ATD': 114,  // Attempted Delivery -> Attempted delivery
    'DLV': 30,   // Delivered -> Delivered
    'POD': 30,   // Proof of Delivery -> Delivered
    'SIG': 82,   // Signature Obtained -> Picture
    
    // Exception Handling
    'EXC': 50,   // Exception -> Exception
    'REF': 115,  // Refused -> Refused
    'UND': 113,  // Undelivered -> Undelivered
    'MSS': 116,  // Missed Appointment -> Appointment missed
    'NDL': 322,  // Not Delivered -> Not delivered
    
    // Delay and Hold Status
    'DLY': 300,  // Delayed -> Delay
    'HLD': 290,  // Hold -> On hold
    'WTH': 120,  // Weather -> Weather delay
    'TFC': 300,  // Traffic -> Delay
    'MDF': 119,  // Mechanical Delay -> Hazardous material delay (closest match)
    'CUS': 25,   // Customs -> In customs
    
    // Special Handling
    'HPU': 280,  // Hold for Pickup -> Held for pick up
    'RTS': 303,  // Return to Sender -> Return to sender
    'RRT': 301,  // Reroute -> Re-routed
    'STG': 304,  // Storage -> Storage
    'SRT': 301,  // Sort/Reroute -> Re-routed
    
    // Appointment Management
    'APT': 122,  // Appointment -> Appointment
    'APC': 260,  // Appointment Confirmed -> Appointment confirmed
    'APM': 116,  // Appointment Missed -> Appointment missed
    'AWA': 250,  // Awaiting Appointment -> Awaiting appointment
    
    // Cancellation and Claims
    'CAN': 40,   // Cancelled -> Cancelled
    'VID': 40,   // Void -> Cancelled
    'CLM': 305,  // Claim -> Claim in process
    'CLR': 306,  // Claim Resolved -> Claim closed
    
    // Final Processing
    'CLS': 70,   // Closed -> Closed
    'CPL': 70,   // Complete -> Closed
    
    // Legacy text-based statuses
    'DELIVERED': 30,        // Delivered (text) -> Delivered
    'IN_TRANSIT': 20,       // In Transit (text) -> In transit
    'OUT_FOR_DELIVERY': 23, // Out for Delivery (text) -> Out for delivery
    'EXCEPTION': 50,        // Exception (text) -> Exception
    'CANCELLED': 40,        // Cancelled (text) -> Cancelled
    'ON_HOLD': 290,         // On Hold (text) -> On hold
    'PICKED_UP': 19,        // Picked Up (text) -> Picked up
    'AT_TERMINAL': 26       // At Terminal (text) -> At terminal
  };
  
  return statusMap[polarisStatus?.toUpperCase()] || 230; // Default to Any/Unknown
}

/**
 * Status progression validation
 */
export const STATUS_PROGRESSION = {
  // Define valid status transitions
  111: [112, 319, 40],           // Request Quote -> Quoted/Booking requested/Cancelled
  112: [319, 309, 40],           // Quoted -> Booking requested/confirmed/Cancelled
  319: [309, 40],                // Booking requested -> confirmed/Cancelled
  309: [16, 22, 12, 40],         // Booking confirmed -> scheduled/appointment/pickup/Cancelled
  16: [12, 19, 40],              // Scheduled for pick up -> Out for pickup/Picked up/Cancelled
  12: [19, 40],                  // Out for pickup -> Picked up/Cancelled
  19: [20, 21, 121, 40],         // Picked up -> In transit/On route/Dropped off/Cancelled
  20: [21, 23, 26, 25, 30, 50],  // In transit -> On route/Out for delivery/At terminal/Customs/Delivered/Exception
  21: [23, 26, 25, 30, 50],      // On route -> Out for delivery/At terminal/Customs/Delivered/Exception
  23: [30, 114, 280, 270],       // Out for delivery -> Delivered/Attempted/Held for pickup/Hold for appointment
  114: [23, 115, 113],           // Attempted delivery -> Out for delivery/Refused/Undelivered
  30: [82, 70],                  // Delivered -> Picture/Closed
  // Add more progression rules as needed
};

export function validateStatusTransition(fromStatusId, toStatusId) {
  const validTransitions = STATUS_PROGRESSION[fromStatusId] || [];
  return validTransitions.includes(toStatusId) || fromStatusId === toStatusId;
}

/**
 * Get suggested next statuses
 */
export function getSuggestedNextStatuses(currentStatusId) {
  const nextStatuses = STATUS_PROGRESSION[currentStatusId] || [];
  return nextStatuses.map(id => ENHANCED_STATUSES[id]).filter(Boolean);
}

export default {
  ENHANCED_STATUSES,
  STATUS_GROUPS,
  STATUS_CATEGORIES,
  LEGACY_STATUS_MAP,
  GRANULAR_TO_LEGACY_MAP,
  getEnhancedStatus,
  getEnhancedStatusColor,
  legacyToEnhanced,
  enhancedToLegacy,
  getStatusesInGroup,
  isStatusInCategory,
  getStatusGroup,
  normalizeCarrierStatusToEnhanced,
  validateStatusTransition,
  getSuggestedNextStatuses
}; 