const functions = require('firebase-functions/v2');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// Import the eShipPlus function
const { getRatesEShipPlus } = require('./src/getRates-EShipPlus');

// Create Express app
const app = express();

// Middleware
app.use(cors({
    origin: ['https://solushipx.web.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "healthy" });
});

// Endpoint to get Google Maps API key
app.get('/api/config/maps-key', (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found in environment variables');
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.json({ key: apiKey });
  } catch (error) {
    console.error('Error serving Google Maps API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to calculate route
app.post('/route', async (req, res) => {
    try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
            console.error('Google Maps API key not found in environment variables');
            return res.status(500).json({ error: 'Google Maps API key not configured' });
        }

        const response = await axios.post(`https://routes.googleapis.com/maps/v2/computeRoutes?key=${apiKey}`, req.body, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error calculating route:', error);
        res.status(500).json({ error: 'Failed to calculate route' });
    }
});

// Export the function
exports.getRatesEShipPlus = getRatesEShipPlus;
