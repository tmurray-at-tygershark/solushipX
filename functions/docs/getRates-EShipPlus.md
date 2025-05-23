# getRatesEShipPlus API Documentation

This API provides access to eShip Plus shipping rates through a SOAP integration. It's designed for external third-party integration.

## Endpoint

```
POST https://us-central1-solushipx.cloudfunctions.net/getRatesEShipPlus
```

## Authentication

Authentication is required via API key.

Include your API key in the request header:

```
x-api-key: YOUR_API_KEY
```

Contact SolushipX to obtain an API key.

## Request Format

The request must be a JSON object with the following structure:

```json
{
  "bookingReferenceNumber": "string",
  "bookingReferenceNumberType": "string",
  "shipmentBillType": "string",
  "shipmentDate": "ISO date string",
  "pickupWindow": {
    "earliest": "HH:MM",
    "latest": "HH:MM"
  },
  "deliveryWindow": {
    "earliest": "HH:MM",
    "latest": "HH:MM"
  },
  "fromAddress": {
    "company": "string",
    "street": "string",
    "street2": "string (optional)",
    "postalCode": "string",
    "city": "string",
    "state": "string",
    "country": "string",
    "contactName": "string",
    "contactPhone": "string",
    "contactEmail": "string",
    "specialInstructions": "string"
  },
  "toAddress": {
    "company": "string",
    "street": "string",
    "street2": "string (optional)",
    "postalCode": "string",
    "city": "string",
    "state": "string",
    "country": "string",
    "contactName": "string",
    "contactPhone": "string",
    "contactEmail": "string",
    "specialInstructions": "string"
  },
  "items": [
    {
      "name": "string",
      "weight": number,
      "length": number,
      "width": number,
      "height": number,
      "quantity": number,
      "freightClass": "string",
      "value": number,
      "stackable": boolean
    }
  ]
}
```

### Required Fields

- `bookingReferenceNumber`: A unique identifier for the booking
- `bookingReferenceNumberType`: Type of booking reference (e.g., "Shipment")
- `shipmentBillType`: Type of shipment bill (e.g., "DefaultLogisticsPlus")
- `shipmentDate`: Date of the shipment in ISO format
- `pickupWindow`: Object with earliest and latest pickup times
- `deliveryWindow`: Object with earliest and latest delivery times
- `fromAddress.postalCode`: Origin postal code
- `fromAddress.contactName`: Origin contact name
- `toAddress.postalCode`: Destination postal code
- `toAddress.contactName`: Destination contact name
- `items`: At least one item with weight and dimensions

## Response Format

### Success Response

Status: 200 OK

```json
{
  "success": true,
  "data": {
    "bookingReference": "string",
    "bookingReferenceType": "string",
    "shipmentBillType": "string",
    "shipmentDate": "string",
    "pickupWindow": {
      "earliest": "string",
      "latest": "string"
    },
    "deliveryWindow": {
      "earliest": "string",
      "latest": "string"
    },
    "origin": {
      "company": "string",
      "street": "string",
      "street2": "string",
      "postalCode": "string",
      "city": "string",
      "state": "string",
      "country": "string",
      "contact": "string",
      "phone": "string",
      "email": "string",
      "specialInstructions": "string"
    },
    "destination": {
      "company": "string",
      "street": "string",
      "street2": "string",
      "postalCode": "string",
      "city": "string",
      "state": "string",
      "country": "string",
      "contact": "string",
      "phone": "string",
      "email": "string",
      "specialInstructions": "string"
    },
    "items": [
      {
        "description": "string",
        "weight": number,
        "dimensions": {
          "length": number,
          "width": number,
          "height": number
        },
        "packagingQuantity": number,
        "freightClass": "string",
        "declaredValue": number,
        "stackable": boolean
      }
    ],
    "availableRates": [
      {
        "quoteId": "string",
        "carrierName": "string",
        "carrierScac": "string",
        "serviceMode": "string",
        "transitTime": number,
        "estimatedDeliveryDate": "string",
        "freightCharges": number,
        "fuelCharges": number,
        "serviceCharges": number,
        "accessorialCharges": number,
        "totalCharges": number,
        "currency": "string",
        "guaranteedService": boolean,
        "guaranteeCharge": number,
        "accessorials": [
          {
            "description": "string",
            "amount": number,
            "category": "string"
          }
        ]
      }
    ]
  }
}
```

### Error Response

Status: 4XX or 5XX

```json
{
  "success": false,
  "error": {
    "message": "Error description"
  }
}
```

## Error Codes

- 400: Bad request (missing or invalid parameters)
- 401: Authentication missing (API key required)
- 403: Authentication failed (invalid API key)
- 405: Method not allowed (use POST)
- 500: Server error (includes SOAP faults from eShip Plus)

## Implementation Details

This API makes SOAP requests to the eShipPlus API endpoint at:
```
http://www.eshipplus.com/services/eShipPlusWSv4.asmx
```

The SOAP request uses the `Rate` operation with authentication details stored securely in environment variables.

## Example

### Request

```bash
curl -X POST \
  https://us-central1-solushipx.cloudfunctions.net/getRatesEShipPlus \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
  "bookingReferenceNumber": "shipment-123",
  "bookingReferenceNumberType": "Shipment",
  "shipmentBillType": "DefaultLogisticsPlus",
  "shipmentDate": "2023-06-15T08:00:00.000Z",
  "pickupWindow": {
    "earliest": "09:00",
    "latest": "17:00"
  },
  "deliveryWindow": {
    "earliest": "09:00",
    "latest": "17:00"
  },
  "fromAddress": {
    "company": "ABC Company",
    "street": "123 Main St",
    "postalCode": "94105",
    "city": "San Francisco",
    "state": "CA",
    "country": "US",
    "contactName": "John Doe",
    "contactPhone": "415-555-1234",
    "contactEmail": "john@example.com",
    "specialInstructions": "none"
  },
  "toAddress": {
    "company": "XYZ Inc",
    "street": "456 Market St",
    "postalCode": "10001",
    "city": "New York",
    "state": "NY",
    "country": "US",
    "contactName": "Jane Smith",
    "contactPhone": "212-555-6789",
    "contactEmail": "jane@example.com",
    "specialInstructions": "none"
  },
  "items": [
    {
      "name": "Box of Supplies",
      "weight": 15.5,
      "length": 24,
      "width": 18,
      "height": 12,
      "quantity": 2,
      "freightClass": "50",
      "value": 500,
      "stackable": true
    }
  ]
}'
```

### Response (Example)

```json
{
  "success": true,
  "data": {
    "bookingReference": "shipment-123",
    "bookingReferenceType": "Shipment",
    "shipmentBillType": "DefaultLogisticsPlus",
    "shipmentDate": "2023-06-15T08:00:00.000Z",
    "pickupWindow": {
      "earliest": "09:00",
      "latest": "17:00"
    },
    "deliveryWindow": {
      "earliest": "09:00",
      "latest": "17:00"
    },
    "origin": {
      "company": "ABC Company",
      "street": "123 Main St",
      "postalCode": "94105",
      "city": "San Francisco",
      "state": "CA",
      "country": "US",
      "contact": "John Doe",
      "phone": "415-555-1234",
      "email": "john@example.com",
      "specialInstructions": "none"
    },
    "destination": {
      "company": "XYZ Inc",
      "street": "456 Market St",
      "postalCode": "10001",
      "city": "New York",
      "state": "NY",
      "country": "US",
      "contact": "Jane Smith",
      "phone": "212-555-6789",
      "email": "jane@example.com",
      "specialInstructions": "none"
    },
    "items": [
      {
        "description": "Box of Supplies",
        "weight": 15.5,
        "dimensions": {
          "length": 24,
          "width": 18,
          "height": 12
        },
        "packagingQuantity": 2,
        "freightClass": "50",
        "declaredValue": 500,
        "stackable": true
      }
    ],
    "availableRates": [
      {
        "quoteId": "quote-12345abc",
        "carrierName": "FedEx",
        "carrierScac": "FDXG",
        "serviceMode": "Ground",
        "transitTime": 3,
        "estimatedDeliveryDate": "2023-06-18T17:00:00.000Z",
        "freightCharges": 100.00,
        "fuelCharges": 15.45,
        "serviceCharges": 8.00,
        "accessorialCharges": 0.00,
        "totalCharges": 123.45,
        "currency": "USD",
        "guaranteedService": false,
        "guaranteeCharge": 0.00,
        "accessorials": []
      },
      {
        "quoteId": "quote-67890xyz",
        "carrierName": "UPS",
        "carrierScac": "UPSN",
        "serviceMode": "Next Day Air",
        "transitTime": 1,
        "estimatedDeliveryDate": "2023-06-16T17:00:00.000Z",
        "freightCharges": 250.00,
        "fuelCharges": 35.75,
        "serviceCharges": 12.00,
        "accessorialCharges": 0.00,
        "totalCharges": 297.75,
        "currency": "USD",
        "guaranteedService": true,
        "guaranteeCharge": 25.00,
        "accessorials": []
      }
    ]
  }
}
```

## Rate Limits

- 100 requests per minute per API key
- 5000 requests per day per API key

For higher rate limits, please contact SolushipX.

## Support

For API support, please contact api-support@solushipx.com 