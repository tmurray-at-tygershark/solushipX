# Firebase Functions v2 Migration Guide for Developers

This guide provides step-by-step instructions for developers to migrate client code from Firebase Functions v1 to v2.

## Migration Steps for Client Code

### Step 1: Identify Function Calls

Search for all instances where Firebase Functions are called in the codebase. Look for patterns like:

```javascript
const myFunction = httpsCallable(functions, 'functionName');
```

### Step 2: Update Function Names

Update the function names from v1 to v2 versions:

| Old Function (v1) | New Function (v2) |
|-------------------|-------------------|
| `getRatesEShipPlus` | `getRatesEShipPlusV2` |

Example:

```javascript
// Before
const getRatesFunction = httpsCallable(functions, 'getRatesEShipPlus');

// After
const getRatesFunction = httpsCallable(functions, 'getRatesEShipPlusV2');
```

### Step 3: Test Your Changes

After updating function calls, thoroughly test the functionality to ensure:

- Functions are called correctly
- All parameters are passed properly
- Responses are handled appropriately

### Step 4: Handling Errors

The error handling pattern should be updated to match the v2 format:

```javascript
// Before (v1)
try {
  const result = await myFunction(data);
  // Process result
} catch (error) {
  // error.code might be 'internal', 'invalid-argument', etc.
  console.error(`Error: ${error.code}`, error);
}

// After (v2)
try {
  const result = await myFunction(data);
  // Process result
} catch (error) {
  // V2 functions use standard Error objects
  console.error(`Error: ${error.message}`, error);
}
```

## Function Documentation

### getRatesEShipPlusV2

**Purpose**: Fetches shipping rates from eShipPlus API based on provided shipment details.

**Parameters**:
- `apiKey`: API key for authentication
- `bookingReferenceNumber`: Reference number for the shipment
- `bookingReferenceNumberType`: Type of reference number
- `shipmentBillType`: Type of the shipment bill
- `shipmentDate`: Date of the shipment
- `pickupWindow`: Object containing earliest and latest pickup times
- `deliveryWindow`: Object containing earliest and latest delivery times
- `fromAddress`: Origin address details
- `toAddress`: Destination address details
- `items`: Array of package/item details

**Example Usage**:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const getRatesFunction = httpsCallable(functions, 'getRatesEShipPlusV2');

const apiKey = process.env.REACT_APP_ESHIP_PLUS_API_KEY || 'development-api-key';

const requestData = {
  apiKey: apiKey,
  bookingReferenceNumber: "shipment-123456",
  bookingReferenceNumberType: "Shipment",
  shipmentBillType: "DefaultLogisticsPlus",
  shipmentDate: new Date().toISOString(),
  pickupWindow: {
    earliest: "09:00",
    latest: "17:00"
  },
  deliveryWindow: {
    earliest: "09:00",
    latest: "17:00"
  },
  fromAddress: {
    company: "ABC Corp",
    street: "123 Main St",
    street2: "Suite 100",
    postalCode: "90210",
    city: "Los Angeles",
    state: "CA",
    country: "US",
    contactName: "John Doe",
    contactPhone: "555-1234",
    contactEmail: "john@example.com",
    specialInstructions: "Call before delivery"
  },
  toAddress: {
    company: "XYZ Inc",
    street: "456 Oak Ave",
    street2: "",
    postalCode: "10001",
    city: "New York",
    state: "NY",
    country: "US",
    contactName: "Jane Smith",
    contactPhone: "555-5678",
    contactEmail: "jane@example.com",
    specialInstructions: "Deliver to receiving dock"
  },
  items: [
    {
      name: "Product Box",
      weight: 10.5,
      length: 12,
      width: 8,
      height: 6,
      quantity: 2,
      freightClass: "50",
      value: 500,
      stackable: true
    }
  ]
};

try {
  const result = await getRatesFunction(requestData);
  const rates = result.data;
  console.log('Available rates:', rates);
} catch (error) {
  console.error('Error fetching rates:', error);
}
```

## Testing Checklist

- [ ] Function accepts all required parameters
- [ ] API key validation works correctly
- [ ] Error handling functions properly
- [ ] Rates are returned in the expected format
- [ ] All client components using the function are updated
- [ ] Performance is comparable to or better than v1

## Rollback Plan

In case of issues, temporarily revert to the v1 function by changing function names back to their original values. 