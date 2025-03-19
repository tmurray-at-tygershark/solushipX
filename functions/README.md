# SolushipX Shipping Rates API

This Firebase Cloud Function provides a REST API for fetching shipping rates from eShipPlus.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env.example` to `.env`
- Fill in your eShipPlus credentials

## Deployment

Deploy to Firebase:
```bash
firebase deploy --only functions
```

## API Endpoints

### GET /health
Health check endpoint to verify the service is running.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2024-03-15T12:00:00Z"
}
```

### POST /rates
Get shipping rates for a shipment.

**Request Body:**
```json
{
    "origin": {
        "postalCode": "53151",
        "city": "New Berlin",
        "state": "WI",
        "country": "US"
    },
    "destination": {
        "postalCode": "L4W1N7",
        "city": "Mississauga",
        "state": "ON",
        "country": "CA"
    },
    "items": [
        {
            "weight": 386.00,
            "height": 10,
            "width": 10,
            "length": 10,
            "quantity": 1
        }
    ]
}
```

**Success Response:**
```json
{
    "success": true,
    "rates": {
        // eShipPlus rate response
    }
}
```

**Error Response:**
```json
{
    "success": false,
    "error": {
        "message": "Error message",
        "code": "ERROR_CODE"
    }
}
```

## Error Codes

- `VALIDATION_ERROR`: Invalid request data
- `API_ERROR`: Error from eShipPlus API
- `INTERNAL_ERROR`: Unexpected server error

## Development

Run locally:
```bash
npm run serve
```

View logs:
```bash
npm run logs
``` 