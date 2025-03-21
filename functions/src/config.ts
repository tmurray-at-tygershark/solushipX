import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const getConfig = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');

    // Only allow GET requests
    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        // Get configuration from environment variables
        const config = {
            livekitToken: process.env.LIVEKIT_TOKEN,
            livekitUrl: process.env.LIVEKIT_URL || 'wss://your-livekit-server.livekit.cloud'
        };

        // Return the configuration
        res.json(config);
    } catch (error) {
        console.error('Error getting configuration:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}); 