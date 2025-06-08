# Carrier Status Mapping Guide

This guide explains how carrier-specific status codes are mapped to the universal enhanced status system in SolushipX.

## 🎯 **Overview**

The enhanced status system provides a unified way to handle status updates from different carriers by mapping their specific status codes to universal status IDs.

## 📋 **Current Mapping Implementation**

### **eShipPlus Check Call Codes**

The `normalizeEShipPlusStatus()` function in `src/utils/enhancedStatusModel.js` maps eShipPlus codes:

```javascript
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
  
  // Exception Phase
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
  
  // Cancellation
  'W1': 40,   // Shipment cancelled -> Cancelled
  
  // Legacy codes for backward compatibility
  'BB': 20,   // In transit (legacy) -> In transit
  'CC': 30,   // Delivered (legacy) -> Delivered
  'DD': 40,   // Cancelled (legacy) -> Cancelled
  'EE': 50,   // Exception (legacy) -> Exception
  'FF': 290   // On hold (legacy) -> On hold
};
```

### **Canpar Tracking Codes**

The `normalizeCanparStatus()` function maps Canpar codes:

```javascript
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
  'DY': 300,  // Delay -> Delay
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
  'CR': 306   // Claim Resolved -> Claim closed
};
```

## 🔄 **How It Works**

### **1. Status Update Process**

When a carrier API returns a status update:

```javascript
// Example: eShipPlus returns check call code "AA"
const eshipResponse = {
  "CheckCalls": [
    {
      "StatusCode": "AA",
      "CallNotes": "Shipment created",
      "CallDate": "2024-06-07T21:02:04"
    }
  ]
};

// The system maps "AA" to enhanced status 112 (Quoted)
const enhancedStatusId = normalizeCarrierStatusToEnhanced('AA', 'ESHIPPLUS');
// Result: 112
```

### **2. Universal Status Lookup**

```javascript
const enhancedStatus = getEnhancedStatus(112);
// Result: {
//   id: 112,
//   name: 'Quoted',
//   category: 'PREPARATION',
//   group: 'PRE_SHIPMENT',
//   color: '#d97706',
//   description: 'Quote provided'
// }
```

### **3. UI Display**

The StatusChip component automatically displays the correct status:

```jsx
<StatusChip 
  status="AA" 
  enhancedStatusId={112} 
  showTooltip={true} 
/>
// Displays: "Quoted" chip with orange color and detailed tooltip
```

## 🔧 **Adding New Carrier Mappings**

### **Step 1: Create Mapping Function**

Add a new carrier mapping function in `enhancedStatusModel.js`:

```javascript
/**
 * NewCarrier specific status normalization
 */
function normalizeNewCarrierStatus(carrierStatus) {
  const statusMap = {
    'NC01': 112,  // NewCarrier Created -> Quoted
    'NC02': 19,   // NewCarrier Picked Up -> Picked up
    'NC03': 20,   // NewCarrier In Transit -> In transit
    'NC04': 30,   // NewCarrier Delivered -> Delivered
    // Add more mappings...
  };
  
  return statusMap[carrierStatus] || 230; // Default to Any/Unknown
}
```

### **Step 2: Update Main Mapping Function**

Add the new carrier to `normalizeCarrierStatusToEnhanced()`:

```javascript
// Carrier-specific mappings
if (carrierType === 'ESHIPPLUS') {
  return normalizeEShipPlusStatus(carrierStatus);
} else if (carrierType === 'CANPAR') {
  return normalizeCanparStatus(carrierStatus);
} else if (carrierType === 'NEWCARRIER') {
  return normalizeNewCarrierStatus(carrierStatus);
}
```

### **Step 3: Update Carrier Detection**

Add carrier detection logic in the status update system:

```javascript
const carrierType = shipment.selectedRate?.displayCarrierId === 'NEWCARRIER' 
  ? 'NEWCARRIER' 
  : 'UNKNOWN';

const enhancedStatusId = normalizeCarrierStatusToEnhanced(
  carrierResponse.statusCode, 
  carrierType
);
```

## 📊 **Real-World Example**

### **eShipPlus Status Update Flow**

1. **API Response**:
   ```json
   {
     "CheckCalls": [
       {
         "StatusCode": "AA",
         "CallNotes": "Shipment created",
         "CallDate": "2024-06-07T21:02:04"
       }
     ]
   }
   ```

2. **Carrier Detection**:
   ```javascript
   const isEShipPlus = shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS';
   const carrierType = isEShipPlus ? 'ESHIPPLUS' : 'UNKNOWN';
   ```

3. **Status Mapping**:
   ```javascript
   const enhancedStatusId = normalizeCarrierStatusToEnhanced('AA', 'ESHIPPLUS');
   // Result: 112 (Quoted)
   ```

4. **Database Update**:
   ```javascript
   await updateDoc(shipmentRef, {
     status: 'draft', // Legacy status for compatibility
     enhancedStatusId: 112,
     lastUpdated: new Date()
   });
   ```

5. **UI Display**:
   ```jsx
   <StatusChip 
     status="draft" 
     enhancedStatusId={112}
     showTooltip={true}
   />
   // Shows: "Quoted" with orange color and tooltip
   ```

## 🎯 **Benefits of This System**

### **1. Carrier Agnostic**
- Single interface for all carrier status updates
- Easy to add new carriers without changing UI code

### **2. Granular Tracking**
- 60+ specific status options instead of basic 8
- Better visibility into shipment lifecycle

### **3. Backward Compatibility**
- Legacy status field maintained for existing integrations
- Gradual migration to enhanced system

### **4. Extensible**
- Easy to add new carriers and status codes
- Centralized mapping logic

## 🚀 **Next Steps**

1. **Expand Polaris Transportation mappings** with their specific PRO status codes
2. **Add FedEx, UPS, DHL mappings** for direct carrier integrations
3. **Create carrier-specific validation rules** for status transitions
4. **Implement status progression tracking** to detect invalid transitions

This system provides a scalable foundation for comprehensive multi-carrier status tracking with granular visibility and easy maintenance. 