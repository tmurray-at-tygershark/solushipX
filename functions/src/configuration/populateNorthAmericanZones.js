/**
 * Cloud Function to Populate North American Zone Data
 * Creates comprehensive geographic data for Zone Management system
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// North American Geographic Data
const countries = [
    {
        code: 'CA',
        name: 'Canada',
        type: 'country',
        patterns: ['CA'],
        metadata: { iso3: 'CAN', continent: 'North America' }
    },
    {
        code: 'US', 
        name: 'United States',
        type: 'country',
        patterns: ['US', 'USA'],
        metadata: { iso3: 'USA', continent: 'North America' }
    },
    {
        code: 'MX',
        name: 'Mexico', 
        type: 'country',
        patterns: ['MX', 'MEX'],
        metadata: { iso3: 'MEX', continent: 'North America' }
    }
];

const canadianProvinces = [
    { code: 'AB', name: 'Alberta', country: 'CA' },
    { code: 'BC', name: 'British Columbia', country: 'CA' },
    { code: 'MB', name: 'Manitoba', country: 'CA' },
    { code: 'NB', name: 'New Brunswick', country: 'CA' },
    { code: 'NL', name: 'Newfoundland and Labrador', country: 'CA' },
    { code: 'NT', name: 'Northwest Territories', country: 'CA' },
    { code: 'NS', name: 'Nova Scotia', country: 'CA' },
    { code: 'NU', name: 'Nunavut', country: 'CA' },
    { code: 'ON', name: 'Ontario', country: 'CA' },
    { code: 'PE', name: 'Prince Edward Island', country: 'CA' },
    { code: 'QC', name: 'Quebec', country: 'CA' },
    { code: 'SK', name: 'Saskatchewan', country: 'CA' },
    { code: 'YT', name: 'Yukon', country: 'CA' }
];

const usStates = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
    { code: 'DC', name: 'District of Columbia' }
];

// Canadian FSA samples (subset for demonstration)
const sampleCanadianFSAs = [
    { code: 'M5V', province: 'ON', description: 'Toronto Downtown' },
    { code: 'K1A', province: 'ON', description: 'Ottawa Government' },
    { code: 'H3A', province: 'QC', description: 'Montreal Downtown' },
    { code: 'V6B', province: 'BC', description: 'Vancouver Downtown' },
    { code: 'T2P', province: 'AB', description: 'Calgary Downtown' },
    { code: 'S4P', province: 'SK', description: 'Regina Downtown' },
    { code: 'R3C', province: 'MB', description: 'Winnipeg Downtown' },
    { code: 'B3J', province: 'NS', description: 'Halifax Downtown' },
    { code: 'E1C', province: 'NB', description: 'Moncton Downtown' },
    { code: 'C1A', province: 'PE', description: 'Charlottetown' },
    { code: 'A1C', province: 'NL', description: "St. John's Downtown" },
    { code: 'X1A', province: 'NT', description: 'Yellowknife' },
    { code: 'Y1A', province: 'YT', description: 'Whitehorse' },
    { code: 'X0A', province: 'NU', description: 'Iqaluit' }
];

// Sample US ZIP3 codes (subset for demonstration)
const sampleUSZIP3s = [
    { code: '100', state: 'NY', description: 'New York City' },
    { code: '200', state: 'DC', description: 'Washington DC' },
    { code: '300', state: 'GA', description: 'Atlanta' },
    { code: '600', state: 'IL', description: 'Chicago' },
    { code: '750', state: 'TX', description: 'Dallas/Fort Worth' },
    { code: '900', state: 'CA', description: 'Los Angeles' },
    { code: '980', state: 'WA', description: 'Seattle' },
    { code: '330', state: 'FL', description: 'Miami' },
    { code: '480', state: 'MI', description: 'Detroit' },
    { code: '020', state: 'MA', description: 'Boston' }
];

const generateRegionId = (type, code) => {
    return `${type}_${code}`.toLowerCase();
};

const createRegionDocument = (regionData, parentId = null) => {
    return {
        ...regionData,
        parentRegionId: parentId,
        enabled: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system'
    };
};

/**
 * Cloud Function to populate North American zones
 */
exports.populateNorthAmericanZones = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540, // 9 minutes
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;
        
        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            logger.info('🚀 Starting North American Zone Population', {
                userId: context.auth.uid,
                userRole: userData.role
            });

            const db = admin.firestore();
            const startTime = Date.now();
            let totalRegions = 0;

            // Clear existing data if requested
            if (data.clearExisting) {
                logger.info('🗑️ Clearing existing regions...');
                const existingRegions = await db.collection('regions').get();
                const batches = [];
                let batch = db.batch();
                let batchCount = 0;

                existingRegions.forEach(doc => {
                    batch.delete(doc.ref);
                    batchCount++;

                    if (batchCount >= 500) {
                        batches.push(batch);
                        batch = db.batch();
                        batchCount = 0;
                    }
                });

                if (batchCount > 0) {
                    batches.push(batch);
                }

                for (const batchItem of batches) {
                    await batchItem.commit();
                }

                logger.info(`🗑️ Cleared ${existingRegions.size} existing regions`);
            }

            // 1. Populate Countries
            logger.info('📍 Populating Countries...');
            let batch = db.batch();
            let count = 0;

            for (const country of countries) {
                const docId = generateRegionId('country', country.code);
                const countryDoc = createRegionDocument(country);
                
                batch.set(db.collection('regions').doc(docId), countryDoc);
                count++;
            }

            await batch.commit();
            totalRegions += count;
            logger.info(`✅ Created ${count} countries`);

            // 2. Populate States and Provinces
            logger.info('🗺️ Populating States and Provinces...');
            batch = db.batch();
            count = 0;

            // Canadian Provinces
            for (const province of canadianProvinces) {
                const docId = generateRegionId('state_province', `CA_${province.code}`);
                const parentId = generateRegionId('country', 'CA');
                
                const provinceDoc = createRegionDocument({
                    code: province.code,
                    name: province.name,
                    type: 'state_province',
                    patterns: [province.code],
                    metadata: { 
                        country: 'CA',
                        country_name: 'Canada',
                        region_type: 'province'
                    }
                }, parentId);
                
                batch.set(db.collection('regions').doc(docId), provinceDoc);
                count++;
            }

            // US States
            for (const state of usStates) {
                const docId = generateRegionId('state_province', `US_${state.code}`);
                const parentId = generateRegionId('country', 'US');
                
                const stateDoc = createRegionDocument({
                    code: state.code,
                    name: state.name,
                    type: 'state_province',
                    patterns: [state.code],
                    metadata: { 
                        country: 'US',
                        country_name: 'United States',
                        region_type: 'state'
                    }
                }, parentId);
                
                batch.set(db.collection('regions').doc(docId), stateDoc);
                count++;
            }

            await batch.commit();
            totalRegions += count;
            logger.info(`✅ Created ${count} states/provinces`);

            // 3. Populate Sample FSAs
            logger.info('🇨🇦 Populating Sample Canadian FSAs...');
            batch = db.batch();
            count = 0;

            for (const fsa of sampleCanadianFSAs) {
                const docId = generateRegionId('fsa', fsa.code);
                const parentId = generateRegionId('state_province', `CA_${fsa.province}`);
                
                const fsaDoc = createRegionDocument({
                    code: fsa.code,
                    name: `Canadian FSA ${fsa.code}`,
                    type: 'fsa',
                    patterns: [fsa.code],
                    metadata: { 
                        province: fsa.province,
                        country: 'CA',
                        region_type: 'forward_sortation_area',
                        description: fsa.description
                    }
                }, parentId);
                
                batch.set(db.collection('regions').doc(docId), fsaDoc);
                count++;
            }

            await batch.commit();
            totalRegions += count;
            logger.info(`✅ Created ${count} Canadian FSAs`);

            // 4. Populate Sample ZIP3s
            logger.info('🇺🇸 Populating Sample US ZIP3 codes...');
            batch = db.batch();
            count = 0;

            for (const zip3 of sampleUSZIP3s) {
                const docId = generateRegionId('zip3', zip3.code);
                const parentId = generateRegionId('state_province', `US_${zip3.state}`);
                
                const zip3Doc = createRegionDocument({
                    code: zip3.code,
                    name: `US ZIP3 ${zip3.code}`,
                    type: 'zip3',
                    patterns: [zip3.code],
                    metadata: {
                        state: zip3.state,
                        country: 'US',
                        region_type: 'zip3',
                        description: zip3.description
                    }
                }, parentId);
                
                batch.set(db.collection('regions').doc(docId), zip3Doc);
                count++;
            }

            await batch.commit();
            totalRegions += count;
            logger.info(`✅ Created ${count} US ZIP3 codes`);

            // 5. Create Default Zone Sets
            logger.info('🗂️ Creating Default Zone Sets...');
            const defaultZoneSets = [
                {
                    name: 'North America Courier Zones',
                    geography: 'NA_COURIER',
                    version: 1,
                    description: 'Standard courier zones covering US, Canada, and Mexico',
                    zoneCount: 10,
                    coverage: 'cross_border',
                    serviceTypes: ['courier', 'express'],
                    enabled: true,
                    metadata: {
                        type: 'courier',
                        regions: ['US', 'CA', 'MX'],
                        zone_structure: 'distance_based'
                    }
                },
                {
                    name: 'Canadian FSA Standard Zones',
                    geography: 'CA_FSA',
                    version: 1,
                    description: 'Canadian Forward Sortation Area based zones',
                    zoneCount: 8,
                    coverage: 'national',
                    serviceTypes: ['courier', 'ltl'],
                    enabled: true,
                    metadata: {
                        type: 'fsa_based',
                        regions: ['CA'],
                        zone_structure: 'fsa_based'
                    }
                },
                {
                    name: 'US ZIP3 Standard Zones',
                    geography: 'US_ZIP3',
                    version: 1,
                    description: 'US 3-digit ZIP code based zones',
                    zoneCount: 12,
                    coverage: 'national',
                    serviceTypes: ['courier', 'ltl'],
                    enabled: true,
                    metadata: {
                        type: 'zip3_based',
                        regions: ['US'],
                        zone_structure: 'zip3_based'
                    }
                }
            ];

            let zoneSetsCount = 0;
            for (const zoneSet of defaultZoneSets) {
                const zoneSetDoc = {
                    ...zoneSet,
                    effectiveFrom: admin.firestore.FieldValue.serverTimestamp(),
                    effectiveTo: null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: context.auth.uid
                };
                
                await db.collection('zoneSets').add(zoneSetDoc);
                zoneSetsCount++;
            }

            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);

            logger.info('🎉 Population Complete!', {
                totalRegions,
                zoneSetsCount,
                duration: `${duration}s`
            });

            return {
                success: true,
                totalRegions,
                breakdown: {
                    countries: countries.length,
                    statesProvinces: canadianProvinces.length + usStates.length,
                    fsaSamples: sampleCanadianFSAs.length,
                    zip3Samples: sampleUSZIP3s.length
                },
                zoneSets: zoneSetsCount,
                duration
            };

        } catch (error) {
            logger.error('❌ Population failed:', error);
            throw new functions.https.HttpsError(
                'internal',
                `Failed to populate zones: ${error.message}`
            );
        }
    });
