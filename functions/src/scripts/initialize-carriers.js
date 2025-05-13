const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with environment variables
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

// Default carriers configuration
const DEFAULT_CARRIERS = [
    {
        id: 'fedex',
        name: 'FedEx',
        description: 'Global shipping and logistics services',
        enabled: true,
        logo: '/images/carrier-badges/fedex.png',
        connected: false,
        credentials: null
    },
    {
        id: 'ups',
        name: 'UPS',
        description: 'Connect your UPS account to enable shipping with UPS services.',
        enabled: true,
        logo: '/images/carrier-badges/ups.png',
        connected: false,
        credentials: null
    },
    {
        id: 'canpar',
        name: 'Canpar',
        description: 'Canadian parcel delivery service',
        enabled: true,
        logo: '/images/carrier-badges/canpar.png',
        connected: false,
        credentials: null
    },
    {
        id: 'purolator',
        name: 'Purolator',
        description: 'Canadian courier and freight services',
        enabled: true,
        logo: '/images/carrier-badges/purolator.png',
        connected: false,
        credentials: null
    },
    {
        id: 'dhl',
        name: 'DHL',
        description: 'International shipping and logistics',
        enabled: true,
        logo: '/images/carrier-badges/dhl.png',
        connected: false,
        credentials: null
    }
];

// Load EDI mappings
const loadEDIMapping = (carrierId) => {
    try {
        const mappingPath = path.join(__dirname, `../edi-mappings/${carrierId}_mapping.json`);
        const mappingData = fs.readFileSync(mappingPath, 'utf8');
        return JSON.parse(mappingData);
    } catch (error) {
        console.error(`Error loading EDI mapping for ${carrierId}:`, error);
        return null;
    }
};

const initializeCarriers = async () => {
    try {
        console.log('Starting carrier initialization...');

        // Create carriers
        for (const carrier of DEFAULT_CARRIERS) {
            const carrierRef = db.collection('carriers').doc(carrier.id);
            
            // Check if carrier exists
            const carrierDoc = await carrierRef.get();
            if (!carrierDoc.exists) {
                console.log(`Creating carrier: ${carrier.name}`);
                await carrierRef.set(carrier);
            }

            // Load and set EDI mapping
            const mapping = loadEDIMapping(carrier.id);
            if (mapping) {
                const mappingsRef = carrierRef.collection('edi_mappings');
                const mappingDoc = await mappingsRef.doc('default').get();
                
                if (!mappingDoc.exists) {
                    console.log(`Setting EDI mapping for ${carrier.name}`);
                    await mappingsRef.doc('default').set(mapping);
                }
            }
        }

        console.log('Carrier initialization completed successfully!');
    } catch (error) {
        console.error('Error initializing carriers:', error);
    } finally {
        process.exit();
    }
};

// Run the initialization
initializeCarriers(); 